import { query, form, command } from '$app/server';
import * as v from 'valibot';

// ─── Simulated database ───
const orders = [
	{ id: 1001, customer: 'Alice Park', item: 'MacBook Pro 16"', total: 2499, status: 'delivered' },
	{ id: 1002, customer: 'Bob Chen', item: 'AirPods Max', total: 549, status: 'shipped' },
	{ id: 1003, customer: 'Carol Kim', item: 'iPad Air', total: 799, status: 'processing' },
	{ id: 1004, customer: 'Dan Lee', item: 'Apple Watch Ultra', total: 799, status: 'processing' },
	{ id: 1005, customer: 'Eve Zhang', item: 'Studio Display', total: 1599, status: 'delivered' }
];

const teamMembers: Record<number, { name: string; role: string; avatar: string }> = {
	1: { name: 'Sarah Connor', role: 'Engineering Lead', avatar: 'SC' },
	2: { name: 'John Reese', role: 'Product Designer', avatar: 'JR' },
	3: { name: 'Root Groves', role: 'Backend Engineer', avatar: 'RG' },
	4: { name: 'Shaw Finch', role: 'DevOps', avatar: 'SF' }
};

// ─── 1. query — Load all recent orders ───
// Like fetching data for a dashboard table
export const getOrders = query(async () => {
	return orders;
});

// ─── 2. query(schema, fn) — Look up a single order ───
// Like clicking a row to see its details
export const getOrderById = query(v.number(), async (id) => {
	const order = orders.find((o) => o.id === id);
	if (!order) throw new Error(`Order #${id} not found`);
	return order;
});

// ─── 3. query.batch — Load team member profiles ───
// Imagine a comment thread: each comment has an authorId.
// Without batching, 4 comments = 4 separate server calls.
// With query.batch, all 4 are combined into ONE call.
export const getTeamMember = query.batch(v.number(), async (ids) => {
	// This function receives ALL requested IDs at once
	// In a real app: SELECT * FROM users WHERE id IN (...)
	return (id: number) => teamMembers[id] ?? null;
});

// ─── 4. query.live — Real-time visitor count ───
// Like a live dashboard metric that updates automatically
let visitorCount = 142;
export const getLiveVisitors = query.live(async function* () {
	while (true) {
		// Simulate fluctuating visitor count
		visitorCount += Math.floor(Math.random() * 11) - 5; // -5 to +5
		if (visitorCount < 100) visitorCount = 100;
		yield { count: visitorCount, updatedAt: new Date().toISOString() };
		await new Promise((r) => setTimeout(r, 2000));
	}
});

// ─── 5. form — Submit a support ticket ───
// Server-validated form with progressive enhancement
export const createTicket = form(
	v.object({
		subject: v.pipe(v.string(), v.nonEmpty('Subject is required'), v.maxLength(100)),
		priority: v.picklist(['low', 'medium', 'high'], 'Pick a priority'),
		description: v.pipe(v.string(), v.nonEmpty('Description is required'))
	}),
	async ({ subject, priority, description }) => {
		console.log(`🎫 New ticket: [${priority}] ${subject} — ${description}`);
		return { ticketId: Math.floor(Math.random() * 9000) + 1000 };
	}
);

// ─── 6. command — Mark an order as shipped ───
// Unlike query, commands are NOT cached or deduplicated.
// They always execute, making them ideal for mutations.
export const markAsShipped = command(v.number(), async (orderId) => {
	const order = orders.find((o) => o.id === orderId);
	if (order) order.status = 'shipped';
	console.log(`📦 Order #${orderId} marked as shipped`);
	return { orderId, newStatus: 'shipped' };
});