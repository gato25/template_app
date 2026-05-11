<script lang="ts">
	import { SocialLogin } from '@capgo/capacitor-social-login';

	let loading = $state(false);
	let error = $state<string | null>(null);
	let user = $state<any>(null);

	async function loginWithGoogle() {
		try {
			loading = true;
			error = null;
			
			const result = await SocialLogin.login({
				provider: 'google',
				options: {}
			});
			
			// Extract idToken and profile data
			const idToken = result.result.idToken;
			user = result.result.profile;
			
			console.log('Login Success!', { idToken, user });
			// TODO: Send idToken to your server (e.g. data.remote.ts) to verify
			
		} catch (err: any) {
			console.error('Login Failed', err);
			error = err.message || 'An error occurred during login';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex flex-col gap-4 p-4 border rounded-xl shadow-sm bg-white max-w-sm w-full mx-auto mt-10">
	<h2 class="text-xl font-semibold text-center">Sign In</h2>
	
	{#if user}
		<div class="flex flex-col items-center gap-2">
			{#if user.imageUrl}
				<img src={user.imageUrl} alt="Profile" class="w-16 h-16 rounded-full" />
			{/if}
			<p class="font-medium text-gray-800">{user.name}</p>
			<p class="text-sm text-gray-500">{user.email}</p>
			<button class="text-sm text-blue-600 hover:underline mt-2" onclick={() => { user = null; SocialLogin.logout({ provider: 'google' }); }}>
				Sign Out
			</button>
		</div>
	{:else}
		<button 
			onclick={loginWithGoogle}
			disabled={loading}
			class="flex items-center justify-center gap-3 w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24">
				<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
				<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
				<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
				<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
			</svg>
			{#if loading}
				Signing in...
			{:else}
				Continue with Google
			{/if}
		</button>
		
		{#if error}
			<p class="text-sm text-red-500 text-center">{error}</p>
		{/if}
	{/if}
</div>
