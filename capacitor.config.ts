import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'template-app',
  webDir: 'build',
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false
      }
    }
  }
};

export default config;
