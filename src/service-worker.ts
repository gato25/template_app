/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];
const WORKER = 'https://template-app.oimod.workers.dev';

// Install: cache static assets
self.addEventListener('install', (event) => {
	self.skipWaiting();
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// Activate: clean old caches, claim clients
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

// Fetch: proxy remote functions only when on a static host (different origin)
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Proxy remote calls ONLY if we're on a different origin (static build)
	// On the worker itself, requests go directly — no proxy needed
	if (url.pathname.startsWith('/_app/remote/') && url.origin !== WORKER) {
		const target = `${WORKER}/proxy-remote/${url.pathname.slice('/_app/remote/'.length)}${url.search}`;

		event.respondWith(
			(async () => {
				const init: RequestInit = {
					method: event.request.method,
					headers: {
						'content-type': event.request.headers.get('content-type') || '',
						accept: event.request.headers.get('accept') || '*/*'
					},
					mode: 'cors'
				};

				if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
					init.body = await event.request.arrayBuffer();
				}

				return fetch(target, init);
			})()
		);
		return;
	}

	// Serve cached assets
	if (event.request.method === 'GET' && ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((r) => r || fetch(event.request)));
	}
});
