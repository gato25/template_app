import { mdsvex } from 'mdsvex';
import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import staticAdapter from '@sveltejs/adapter-static';

const isStatic = !!process.env.BUILD_STATIC;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
		experimental: {
			async: true
		}
	},
	kit: {
		adapter: isStatic
			? staticAdapter({
					fallback: 'index.html'
				})
			: cloudflareAdapter(),
		csrf: {
			checkOrigin: false
		},
		experimental: {
			remoteFunctions: true
		}
	},
	preprocess: [mdsvex({ extensions: ['.svx', '.md'] })],
	extensions: ['.svelte', '.svx', '.md']
};

export default config;
