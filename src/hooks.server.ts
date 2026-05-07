import type { Handle } from '@sveltejs/kit';

const cors = (origin: string | null) => ({
	'Access-Control-Allow-Origin': origin || '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': '*',
	...(origin && { 'Access-Control-Allow-Credentials': 'true' })
});

export const handle: Handle = async ({ event, resolve }) => {
	const origin = event.request.headers.get('origin');

	if (event.request.method === 'OPTIONS') {
		return new Response(null, { headers: cors(origin) });
	}

	const response = await resolve(event);
	for (const [k, v] of Object.entries(cors(origin))) {
		response.headers.set(k, v);
	}
	return response;
};
