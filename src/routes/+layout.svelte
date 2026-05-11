<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { SocialLogin } from '@capgo/capacitor-social-login';
	import { NotificationService } from '$lib/services/notifications';

	let { children } = $props();

	onMount(async () => {
		SocialLogin.initialize({
			google: {
				webClientId: '495950306427-qsjgqljf7vovnm67g12l9hpvijqk50t0.apps.googleusercontent.com',
				iosClientId: '495950306427-9gqt4vsfspc3di0mpqh27232ij20d0oo.apps.googleusercontent.com',
			}
		});

		// Initialize push notifications
		await NotificationService.init();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
