<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	onMount(async () => {
		const isNative = browser && (window.origin.startsWith('capacitor:') || (window.location.hostname === 'localhost' && !window.location.port));

		// Only register Service Worker on Web (non-native)
		if (browser && !isNative && 'serviceWorker' in navigator) {
			try {
				const reg = await navigator.serviceWorker.register('/service-worker.js');
				console.log('[App] SW registered:', reg.scope);
			} catch (err) {
				console.error('[App] SW registration failed:', err);
			}
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
