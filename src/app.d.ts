// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				SURREAL_URL: string;
				SURREAL_USER: string;
				SURREAL_PASS: string;
				SURREAL_NS: string;
				SURREAL_DB: string;
			};
		}
	}
}

export {};
