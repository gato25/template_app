import { Surreal, createRemoteEngines } from 'surrealdb';
import { createNodeEngines } from '@surrealdb/node';

export type DbEnv = {
	SURREAL_URL: string;
	SURREAL_USER: string;
	SURREAL_PASS: string;
	SURREAL_NS: string;
	SURREAL_DB: string;
};

let instance: Surreal | null = null;
let lastUrl: string | null = null;

export async function getDb(env: DbEnv): Promise<Surreal> {
	if (instance && lastUrl === env.SURREAL_URL) {
		return instance;
	}

	if (instance) {
		await instance.close();
		instance = null;
	}

	const db = new Surreal({
		engines: {
			...createRemoteEngines(),
			...createNodeEngines()
		},
		codecOptions: {
			useNativeDates: true
		}
	});

	await db.connect(env.SURREAL_URL, {
		namespace: env.SURREAL_NS,
		database: env.SURREAL_DB,
		authentication: {
			username: env.SURREAL_USER,
			password: env.SURREAL_PASS
		},
		reconnect: { enabled: true }
	});

	instance = db;
	lastUrl = env.SURREAL_URL;
	return instance;
}

export type Db = Surreal;
