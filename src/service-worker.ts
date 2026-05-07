/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];
const WORKER = 'https://template-app.oimod.workers.dev';

const sw = self as unknown as ServiceWorkerGlobalScope;

console.log('[SW] Service Worker loading...', version);

// Install: cache static assets
sw.addEventListener('install', (event) => {
	console.log('[SW] Install event');
	const e = event as ExtendableEvent;
	sw.skipWaiting();
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// Activate: clean old caches, claim clients
sw.addEventListener('activate', (event) => {
	console.log('[SW] Activate event');
	const e = event as ExtendableEvent;
	e.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

// Fetch: proxy remote functions only when on a static host (different origin)
sw.addEventListener('fetch', (event) => {
	const e = event as FetchEvent;
	const url = new URL(e.request.url);

	// console.log('[SW] Fetching:', url.href);

	// Proxy remote calls ONLY if we're on a different origin (static build or native app)
	// We proxy if:
	// 1. We are not on the worker origin
	// 2. We are either on a non-localhost domain OR we are on a native scheme (capacitor://)
	const isNative = url.protocol === 'capacitor:' || (url.protocol === 'http:' && !url.port && url.hostname === 'localhost');

	if (
		url.pathname.startsWith('/_app/remote/') &&
		url.origin !== WORKER &&
		(isNative || !url.hostname.includes('localhost'))
	) {
		console.log(`[SW] Proxying: ${url.pathname} -> ${WORKER}`);
		const target = `${WORKER}/proxy-remote/${url.pathname.slice('/_app/remote/'.length)}${url.search}`;

		e.respondWith(
			(async () => {
				const headers = new Headers();
				headers.set('content-type', e.request.headers.get('content-type') || 'application/json');
				headers.set('accept', e.request.headers.get('accept') || '*/*');

				const init: RequestInit = {
					method: e.request.method,
					headers
				};

				if (e.request.method !== 'GET' && e.request.method !== 'HEAD') {
					init.body = await e.request.arrayBuffer();
				}

				try {
					return await fetch(target, init);
				} catch (err) {
					console.error('[SW] Proxy fetch failed:', err);
					throw err;
				}
			})()
		);
		return;
	}

	// Serve cached assets
	if (e.request.method === 'GET' && ASSETS.includes(url.pathname)) {
		e.respondWith(caches.match(url.pathname).then((r) => r || fetch(e.request)));
	}
});
