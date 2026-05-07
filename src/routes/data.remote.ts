import { query, form, command } from '$app/server';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';
import { orders, teamMembers, tickets } from '$lib/server/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import * as v from 'valibot';

import { env } from '$env/dynamic/private';

function db() {
	const { platform } = getRequestEvent();
	const tursoUrl = platform?.env?.TURSO_URL || env.TURSO_URL;
	const tursoToken = platform?.env?.TURSO_TOKEN || env.TURSO_TOKEN;

	if (!tursoUrl) {
		throw new Error('TURSO_URL is not defined in platform.env or process.env');
	}

	return getDb({ TURSO_URL: tursoUrl, TURSO_TOKEN: tursoToken || '' });
}

// ─── 1. query — Load all recent orders ───
export const getOrders = query(async () => {
	return db().select().from(orders).orderBy(desc(orders.createdAt)).limit(50);
});

// ─── 2. query(schema, fn) — Look up a single order ───
export const getOrderById = query(v.number(), async (id) => {
	const rows = await db().select().from(orders).where(eq(orders.id, id)).limit(1);
	if (!rows[0]) throw new Error(`Order #${id} not found`);
	return rows[0];
});

// ─── 3. query.batch — Load team member profiles ───
export const getTeamMember = query.batch(v.number(), async (ids) => {
	const rows = await db()
		.select()
		.from(teamMembers)
		.where(inArray(teamMembers.id, ids));
	const lookup = new Map(rows.map((m) => [m.id, m]));
	return (id: number) => lookup.get(id) ?? null;
});

// ─── 4. query.live — Real-time visitor count ───
// Simulated — real visitor tracking needs Durable Objects or KV
let visitorCount = 142;
export const getLiveVisitors = query.live(async function* () {
	while (true) {
		visitorCount += Math.floor(Math.random() * 11) - 5;
		if (visitorCount < 100) visitorCount = 100;
		yield { count: visitorCount, updatedAt: new Date().toISOString() };
		await new Promise((r) => setTimeout(r, 2000));
	}
});

// ─── 5. form — Submit a support ticket ───
export const createTicket = form(
	v.object({
		subject: v.pipe(v.string(), v.nonEmpty('Subject is required'), v.maxLength(100)),
		priority: v.picklist(['low', 'medium', 'high'], 'Pick a priority'),
		description: v.pipe(v.string(), v.nonEmpty('Description is required'))
	}),
	async ({ subject, priority, description }) => {
		console.log('Inserting ticket:', { subject, priority, description });
		const result = await db()
			.insert(tickets)
			.values({ subject, priority, description })
			.returning({ ticketId: tickets.id });
		console.log('Insert result:', result);
		return { ticketId: result[0].ticketId };
	}
);

// ─── 6. command — Mark an order as shipped ───
export const markAsShipped = command(v.number(), async (orderId) => {
	await db().update(orders).set({ status: 'shipped' }).where(eq(orders.id, orderId));
	return { orderId, newStatus: 'shipped' };
});