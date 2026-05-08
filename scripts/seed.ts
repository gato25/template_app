import { Surreal, createRemoteEngines } from 'surrealdb';
import { createNodeEngines } from '@surrealdb/node';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.SURREAL_URL ?? 'ws://127.0.0.1:8000/rpc';
const user = process.env.SURREAL_USER ?? 'root';
const pass = process.env.SURREAL_PASS ?? 'secret';
const ns = process.env.SURREAL_NS ?? 'app';
const db_name = process.env.SURREAL_DB ?? 'main';

const db = new Surreal({
	engines: {
		...createRemoteEngines(),
		...createNodeEngines()
	}
});

await db.connect(url, {
	namespace: ns,
	database: db_name,
	authentication: { username: user, password: pass }
});

// ─── Clear existing data ───
try { await db.query('DELETE orders'); } catch (_) {}
try { await db.query('DELETE team_members'); } catch (_) {}
try { await db.query('DELETE tickets'); } catch (_) {}

// ─── Seed team members ───
await db.query(`
	INSERT INTO team_members (id, name, role, avatar) VALUES
		(1, 'Sarah Connor', 'Engineering Lead', 'SC'),
		(2, 'John Reese', 'Product Designer', 'JR'),
		(3, 'Root Groves', 'Backend Engineer', 'RG'),
		(4, 'Shaw Finch', 'DevOps', 'SF')
`);

// ─── Seed orders ───
await db.query(`
	INSERT INTO orders (id, customer, item, total, status, created_at) VALUES
		(1001, 'Alice Park', 'MacBook Pro 16"', 2499.00, 'delivered', time::now()),
		(1002, 'Bob Chen', 'AirPods Max', 549.00, 'shipped', time::now()),
		(1003, 'Carol Kim', 'iPad Air', 799.00, 'processing', time::now()),
		(1004, 'Dan Lee', 'Apple Watch Ultra', 799.00, 'processing', time::now()),
		(1005, 'Eve Zhang', 'Studio Display', 1599.00, 'delivered', time::now())
`);

await db.close();
console.log('✅ Seeded orders and team members into SurrealDB');
process.exit(0);
