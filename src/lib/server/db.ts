import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type DbEnv = {
    TURSO_URL: string;
    TURSO_TOKEN: string;
};

let lastUrl: string | null = null;
let cachedDb: LibSQLDatabase<typeof schema> | null = null;

export function getDb(env: DbEnv) {
    if (cachedDb && lastUrl === env.TURSO_URL) {
        return cachedDb;
    }

    const client = createClient({
        url: env.TURSO_URL,
        authToken: env.TURSO_TOKEN
    });

    lastUrl = env.TURSO_URL;
    cachedDb = drizzle(client, { schema });
    return cachedDb;
}

export type Db = LibSQLDatabase<typeof schema>;
