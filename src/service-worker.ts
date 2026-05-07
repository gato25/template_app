/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];
const WORKER = 'https://template-app.oimod.workers.dev';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Install: cache static assets
sw.addEventListener('install', (event) => {
	const e = event as ExtendableEvent;
	sw.skipWaiting();
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// Activate: clean old caches, claim clients
sw.addEventListener('activate', (event) => {
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

	// Proxy remote calls ONLY if we're on a different origin (static build)
	// On the worker itself, requests go directly — no proxy needed
	if (url.pathname.startsWith('/_app/remote/') && url.origin !== WORKER) {
		const target = `${WORKER}/proxy-remote/${url.pathname.slice('/_app/remote/'.length)}${url.search}`;

		e.respondWith(
			(async () => {
				const init: RequestInit = {
					method: e.request.method,
					headers: {
						'content-type': e.request.headers.get('content-type') || '',
						accept: e.request.headers.get('accept') || '*/*'
					},
					mode: 'cors'
				};

				if (e.request.method !== 'GET' && e.request.method !== 'HEAD') {
					init.body = await e.request.arrayBuffer();
				}

				return fetch(target, init);
			})()
		);
		return;
	}

	// Serve cached assets
	if (e.request.method === 'GET' && ASSETS.includes(url.pathname)) {
		e.respondWith(caches.match(url.pathname).then((r) => r || fetch(e.request)));
	}
});
