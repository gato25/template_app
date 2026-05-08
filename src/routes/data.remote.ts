import { query, form, command, getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import * as v from 'valibot';
import { RecordId, Table, surql, type RecordResult } from 'surrealdb';
import { getDb } from '$lib/server/db';

type OrderStatus = 'delivered' | 'shipped' | 'processing';

type Order = RecordResult<{
	id: RecordId<'orders', number>;
	customer: string;
	item: string;
	total: number;
	status: OrderStatus;
	created_at: Date;
}>;

type TeamMember = RecordResult<{
	id: RecordId<'team_members', number>;
	name: string;
	role: string;
	avatar: string;
}>;

type Ticket = {
	subject: string;
	priority: 'low' | 'medium' | 'high';
	description: string;
	created_at: Date;
};

async function db() {
	getRequestEvent();
	return getDb({
		SURREAL_URL: env.SURREAL_URL,
		SURREAL_USER: env.SURREAL_USER,
		SURREAL_PASS: env.SURREAL_PASS,
		SURREAL_NS: env.SURREAL_NS,
		SURREAL_DB: env.SURREAL_DB
	});
}

// ─── 1. query — Load all recent orders ───
export const getOrders = query(async () => {
	const surreal = await db();
	const [orders] = await surreal.query<[Order[]]>(
		surql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 50`
	);
	return orders ?? [];
});

// ─── 2. query(schema, fn) — Look up a single order ───
export const getOrderById = query(v.number(), async (id) => {
	const surreal = await db();
	const order = await surreal.select<Order>(new RecordId('orders', id));
	if (!order) throw new Error(`Order #${id} not found`);
	return order;
});

// ─── 3. query.batch — Load team member profiles ───
export const getTeamMember = query.batch(v.number(), async (ids) => {
	const surreal = await db();
	const [members] = await surreal.query<[TeamMember[]]>(
		'SELECT * FROM team_members WHERE id IN $ids',
		{ ids: ids.map((id) => new RecordId('team_members', id)) }
	);
	const lookup = new Map((members ?? []).map((m) => [m.id.id, m]));
	return (id: number) => lookup.get(id) ?? null;
});

// ─── 4. query.live — Real-time visitor count ───
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
		const surreal = await db();
		const created = await surreal.create<Ticket>(new Table('tickets')).content({
			subject,
			priority,
			description,
			created_at: new Date()
		});
		const ticket = created[0];
		return { ticketId: ticket?.id.toString() ?? 'unknown' };
	}
);

// ─── 6. command — Mark an order as shipped ───
export const markAsShipped = command(v.number(), async (orderId) => {
	const surreal = await db();
	await surreal
		.update<Order>(new RecordId('orders', orderId))
		.merge({ status: 'shipped' });
	return { orderId, newStatus: 'shipped' as const };
});
