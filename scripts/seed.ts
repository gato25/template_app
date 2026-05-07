import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { orders, teamMembers } from '../src/lib/server/schema';

const client = createClient({
	url: process.env.TURSO_URL!,
	authToken: process.env.TURSO_TOKEN
});

const db = drizzle(client);

await db.delete(teamMembers);
await db.delete(orders);

await db.insert(teamMembers).values([
	{ id: 1, name: 'Sarah Connor', role: 'Engineering Lead', avatar: 'SC' },
	{ id: 2, name: 'John Reese', role: 'Product Designer', avatar: 'JR' },
	{ id: 3, name: 'Root Groves', role: 'Backend Engineer', avatar: 'RG' },
	{ id: 4, name: 'Shaw Finch', role: 'DevOps', avatar: 'SF' }
]);

await db.insert(orders).values([
	{ id: 1001, customer: 'Alice Park', item: 'MacBook Pro 16"', total: 2499, status: 'delivered' },
	{ id: 1002, customer: 'Bob Chen', item: 'AirPods Max', total: 549, status: 'shipped' },
	{ id: 1003, customer: 'Carol Kim', item: 'iPad Air', total: 799, status: 'processing' },
	{ id: 1004, customer: 'Dan Lee', item: 'Apple Watch Ultra', total: 799, status: 'processing' },
	{ id: 1005, customer: 'Eve Zhang', item: 'Studio Display', total: 1599, status: 'delivered' }
]);

console.log('✅ Seeded orders and team members');
process.exit(0);
