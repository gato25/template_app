# Capacitor Native Google Authentication (SvelteKit)

This document captures the essential steps, requirements, and troubleshooting steps for implementing native Google Sign-In in a SvelteKit Capacitor application using `@capgo/capacitor-social-login`.

## 1. Plugin Configuration

Install the plugin and configure `capacitor.config.ts` to disable unnecessary SDKs to reduce the native bundle size:

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  plugins: {
    SocialLogin: {
      google: true,
      facebook: false,
      apple: false,
      twitter: false
    }
  }
};
```

## 2. Google Cloud Console Setup

You must create **TWO** OAuth 2.0 Client IDs inside the **EXACT SAME** Google Cloud Project:

1. **Web Client ID (Web application)**
   - Add your frontend dev URLs (e.g., `http://localhost:5173`) to the Authorized JavaScript origins and Redirect URIs.
   - This ID represents your "Backend" and is the ONLY ID that you will paste into your app's code.
2. **Android Client ID (Android)**
   - Requires your Android Package Name (e.g., `com.example.app`).
   - Requires the SHA-1 fingerprint of the keystore you are using to sign the app.
   - **Crucial:** You DO NOT put this Android Client ID in your code. Google Play Services will automatically detect your app's signature and link it to this Client ID behind the scenes.

## 3. Android Native Setup

### `strings.xml`
The plugin requires the **Web Client ID** to be hardcoded in your Android resources so the Google Credential Manager can request tokens on behalf of your server.

```xml
<!-- android/app/src/main/res/values/strings.xml -->
<resources>
    <string name="server_client_id">YOUR_WEB_CLIENT_ID.apps.googleusercontent.com</string>
</resources>
```

### Keystore Signing (`build.gradle`)
To test Google Sign-In locally, your Android Studio `Run` button must sign the app with a keystore that has a SHA-1 fingerprint matching your Android Client ID. For consistency, you can force the `debug` build to use a `release.keystore`:

```gradle
// android/app/build.gradle
android {
    signingConfigs {
        release {
            storeFile file("release.keystore")
            storePassword "android"
            keyAlias "release"
            keyPassword "android"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
        debug {
            // Optional: force debug to use release keystore so SHA-1 always matches
            signingConfig signingConfigs.release
        }
    }
}
```

## 4. SvelteKit Initialization

You must initialize the plugin as early as possible (e.g., in `+layout.svelte`'s `onMount`), passing in the **Web Client ID**:

```svelte
<script lang="ts">
import { SocialLogin } from '@capgo/capacitor-social-login';
import { onMount } from 'svelte';

onMount(() => {
    SocialLogin.initialize({
        google: {
            webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
        }
    });
});
</script>
```

Trigger the login flow:

```svelte
<script lang="ts">
import { SocialLogin } from '@capgo/capacitor-social-login';

async function handleGoogleLogin() {
    try {
        const res = await SocialLogin.login({ provider: 'google' });
        console.log("Login Success!", res.result.idToken, res.result.profile);
    } catch (err) {
        console.error("Login Failed", err);
    }
}
</script>
```

## 5. Troubleshooting 

### `[28444] Developer console is not set up correctly`
This is the most common and frustrating error. It means your Android app's signature matched, but Google rejected the request because of a Cloud Console misconfiguration.

**Checklist to fix 28444:**
1. **OAuth Consent Screen (Most Common):** If your app is set to "External" and is in "Testing" mode, you **MUST** add the Google email address you are trying to log in with to the **Test Users** list.
2. **Missing Contact Info:** Ensure the "User support email" and "Developer contact information" are filled out on the OAuth Consent Screen.
3. **Mismatched Projects:** The Web Client ID and Android Client ID **must** be created inside the exact same Google Cloud Project. If you create them in different projects, Google will throw this error because the Android app is requesting a Web Client ID that it doesn't have permissions for.
4. **Already In Use:** If you try to create an Android Client ID and get the error `"The Android package name and fingerprint are already in use"`, it means you orphaned it in another Google Cloud project. You must find the other project, delete the Android Client ID, and recreate it in the correct project.
5. **Clean Build:** If you recently updated `strings.xml`, run `Build -> Clean Project` in Android Studio to ensure the old cached XML file isn't being packaged into the APK.
