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

		type ItemType = {
			name: string,
			pinCoordinates: Point[]
		}

		type PlacedItem = {
			type: ItemType,
			padCoordinates: Point,
		}
	}
}

export {};
