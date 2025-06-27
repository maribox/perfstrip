/// <reference types="unplugin-icons/types/svelte" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}

		type Point = [number, number]

		export type PlacedPart = {
			position: Point;
			width: number;
			height: number;
			lib_name: [string, string];
			part: Part;
		}

		export type Pin = {
			key: string;
			name: string;
			position: Point;
		}
	}
}

export { };
