import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite'
import path from 'path';

export default defineConfig({
	plugins: [
		tailwindcss(), 
		sveltekit(),
		Icons({
			autoInstall: true,
			compiler: 'svelte'
		}),
	],
});