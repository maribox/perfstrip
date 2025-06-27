import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import Icons from 'unplugin-icons/vite'
import AutoImport from 'unplugin-auto-import/vite'
import IconsResolver from 'unplugin-icons/resolver'

export default defineConfig({
	plugins: [
		tailwindcss(), 
		sveltekit(),
		Icons({
			autoInstall: true,
			compiler: 'svelte',
		}),
		AutoImport({
			resolvers: [
				IconsResolver({
					prefix: 'Icon'
				})
			],
			dts: './src/auto-imports.d.ts'
		}),
	],
});