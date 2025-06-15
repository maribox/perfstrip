import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			ssr: false,
			prerender: {
				default: true,
			},
			fallback: "200.html" // depends on the static host -> look at what docs say/set in the config
		}),
		
		// gets sent to TS and Vite
		alias: {
			'xtoedif': '../libs/xtoedif/src/index.ts'
		}
	}
};

export default config;
