import type { RequestHandler } from './$types';

export const fallback: RequestHandler = async ({ params, request, url, fetch }) => {
	const headers = new Headers(request.headers);
	headers.delete('origin'); // bypass SvelteKit's cross-site check
	headers.delete('host'); // avoid host mismatch

	// Use the explicit Cloudflare Worker URL for the target
	const WORKER = 'https://template-app.oimod.workers.dev';
	const target = `${WORKER}/_app/remote/${params.path}${url.search}`;

	const res = await fetch(target, {
		method: request.method,
		headers,
		body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
	});

	const out = new Response(res.body, res);
	out.headers.set('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
	out.headers.set('Access-Control-Allow-Credentials', 'true');
	return out;
};
