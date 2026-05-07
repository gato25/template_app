import { integer, real, text, sqliteTable } from 'drizzle-orm/sqlite-core';

export const orders = sqliteTable('orders', {
	id: integer('id').primaryKey(),
	customer: text('customer').notNull(),
	item: text('item').notNull(),
	total: real('total').notNull(),
	status: text('status', { enum: ['delivered', 'shipped', 'processing'] })
		.notNull()
		.default('processing'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

export const teamMembers = sqliteTable('team_members', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	role: text('role').notNull(),
	avatar: text('avatar').notNull()
});

export const tickets = sqliteTable('tickets', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	subject: text('subject').notNull(),
	priority: text('priority', { enum: ['low', 'medium', 'high'] }).notNull(),
	description: text('description').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});
