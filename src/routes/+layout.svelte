<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { SocialLogin } from '@capgo/capacitor-social-login';

	let { children } = $props();

	onMount(() => {
		SocialLogin.initialize({
			google: {
				webClientId: '495950306427-qsjgqljf7vovnm67g12l9hpvijqk50t0.apps.googleusercontent.com',
				iosClientId: '495950306427-9gqt4vsfspc3di0mpqh27232ij20d0oo.apps.googleusercontent.com',
			}
		});
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
