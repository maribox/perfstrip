import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite'
import UnpluginTypia from '@ryoppippi/unplugin-typia/vite'

export default defineConfig({
	plugins: [
		tailwindcss(), 
		sveltekit(),
		Icons({
			autoInstall: true,
			compiler: 'svelte'
		}),
		UnpluginTypia()
	],
});