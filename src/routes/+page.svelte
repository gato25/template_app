<script lang="ts">
	import {
		getOrders,
		getOrderById,
		getTeamMember,
		getLiveVisitors,
		createTicket,
		markAsShipped
	} from './data.remote';

	let selectedOrderId = $state(1001);
	let shippedResult = $state('');
	let shippedLoading = $state(false);

	const visitors = getLiveVisitors();

	const orderIds = [1001, 1002, 1003, 1004, 1005];
</script>

<svelte:boundary>
	<main>
		<header>
			<div class="header-top">
				<h1>Remote Functions</h1>
				<div class="live-badge">
					<span class="pulse"></span>
					{(await visitors)?.count ?? '—'} visitors
				</div>
			</div>
			<p>
				A mini admin dashboard showcasing every SvelteKit remote function pattern.<br />
				Each card below calls a function that runs on the <strong>server</strong> — the client just calls it like a normal function.
			</p>
		</header>

		<!-- ━━━━━━━━━━ 1. QUERY ━━━━━━━━━━ -->
		<section>
			<div class="section-header">
				<span class="badge blue">query</span>
				<div>
					<h2>Recent Orders</h2>
					<p class="what">Load a list of data from the server</p>
				</div>
			</div>
			<p class="how">
				<code>query(fn)</code> wraps a server function. Call it in your template with <code>await</code>, and it returns cached data. Call <code>.refresh()</code> to re-fetch.
			</p>

			<div class="card">
				<table>
					<thead>
						<tr>
							<th>Order</th>
							<th>Customer</th>
							<th>Item</th>
							<th>Total</th>
							<th>Status</th>
						</tr>
					</thead>
					{#snippet ordersFailed(err: unknown)}
						<tr>
							<td colspan="5" class="error" style="text-align: center;">Failed to load orders: {err instanceof Error ? err.message : String(err)}</td>
						</tr>
					{/snippet}
					<tbody>
						<svelte:boundary failed={ordersFailed}>
							{#each await getOrders() as order (order.id.id)}
								<tr>
									<td class="mono">#{order.id.id}</td>
									<td>{order.customer}</td>
									<td>{order.item}</td>
									<td class="mono">${order.total}</td>
									<td><span class="status-pill {order.status}">{order.status}</span></td>
								</tr>
							{/each}
						</svelte:boundary>
					</tbody>
				</table>
			</div>
			<button class="btn" onclick={() => getOrders().refresh()}>↻ Refresh Orders</button>
		</section>

		<!-- ━━━━━━━━━━ 2. QUERY + ARGS ━━━━━━━━━━ -->
		<section>
			<div class="section-header">
				<span class="badge blue">query + schema</span>
				<div>
					<h2>Order Lookup</h2>
					<p class="what">Fetch a specific item by its ID</p>
				</div>
			</div>
			<p class="how">
				Add a schema as the first argument to validate inputs. The query <strong>re-runs automatically</strong> when the argument changes — no manual refresh needed.
			</p>

			<div class="pill-picker">
				{#each orderIds as id (id)}
					<button
						class="pill"
						class:active={selectedOrderId === id}
						onclick={() => (selectedOrderId = id)}
					>
						#{id}
					</button>
				{/each}
			</div>

			{#snippet orderLookupFailed(err: unknown)}
				<p class="error">{err instanceof Error ? err.message : String(err)}</p>
			{/snippet}
			<div class="card">
				<svelte:boundary failed={orderLookupFailed}>
					{@const order = await getOrderById(selectedOrderId)}
					<div class="detail-grid">
						<div class="detail-item">
							<span class="detail-label">Order ID</span>
							<span class="detail-value mono">#{order.id.id}</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Customer</span>
							<span class="detail-value">{order.customer}</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Item</span>
							<span class="detail-value">{order.item}</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Total</span>
							<span class="detail-value mono">${order.total}</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Status</span>
							<span class="detail-value"><span class="status-pill {order.status}">{order.status}</span></span>
						</div>
					</div>
				</svelte:boundary>
			</div>
		</section>

		<!-- ━━━━━━━━━━ 3. QUERY.BATCH ━━━━━━━━━━ -->
		<section>
			<div class="section-header">
				<span class="badge teal">query.batch</span>
				<div>
					<h2>Team Directory</h2>
					<p class="what">4 calls → 1 server request</p>
				</div>
			</div>
			<p class="how">
				Each card calls <code>getTeamMember(id)</code> separately. Without batching, that's 4 network requests.
				With <code>query.batch</code>, SvelteKit <strong>automatically combines</strong> them into a single server call — solving the N+1 problem.
			</p>

			<div class="team-grid">
				{#each [1, 2, 3, 4] as id (id)}
					{@const member = await getTeamMember(id)}
					{#if member}
						<div class="team-card">
							<div class="avatar">{member.avatar}</div>
							<div>
								<strong>{member.name}</strong>
								<span class="role">{member.role}</span>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</section>

		<!-- ━━━━━━━━━━ 4. QUERY.LIVE ━━━━━━━━━━ -->
		<section>
			<div class="section-header">
				<span class="badge green">query.live</span>
				<div>
					<h2>Live Visitors</h2>
					<p class="what">Real-time data streamed from the server</p>
				</div>
			</div>
			<p class="how">
				Uses an <code>async function*</code> (generator) to <strong>push values</strong> to the client over a streaming connection.
				No polling, no manual refresh — data arrives automatically. Use <code>.connected</code> to check status.
			</p>

			<svelte:boundary>
				{@const v = await visitors}
				<div class="card live-card">
					<div class="live-number">{v?.count ?? '—'}</div>
					<div class="live-label">active visitors right now</div>
					<div class="live-meta">
						Last update: {v ? new Date(v.updatedAt).toLocaleTimeString() : '—'}
						<span class="dot" class:connected={visitors.connected}></span>
						{visitors.connected ? 'Streaming' : 'Disconnected'}
					</div>
				</div>
			</svelte:boundary>
			<button class="btn" onclick={() => visitors.reconnect()}>⟳ Reconnect Stream</button>
		</section>

		<!-- ━━━━━━━━━━ 5. FORM ━━━━━━━━━━ -->
		<section>
			<div class="section-header">
				<span class="badge orange">form</span>
				<div>
					<h2>Submit Support Ticket</h2>
					<p class="what">Server-validated form with zero client boilerplate</p>
				</div>
			</div>
			<p class="how">
				Spread <code>createTicket</code> onto <code>&lt;form&gt;</code> and each field with <code>.as('text')</code>.
				Validation runs on the server with your schema. Errors show per-field via <code>.issues()</code>.
				Works <strong>without JavaScript</strong> too (progressive enhancement).
			</p>

			<div class="card">
				<form {...createTicket} class="ticket-form">
					<div class="field">
						<label for="t-subject">Subject</label>
						<input id="t-subject" {...createTicket.fields.subject.as('text')} placeholder="e.g. Can't access billing page" />
						{#each createTicket.fields.subject.issues() as issue (issue.message)}
							<span class="field-error">{issue.message}</span>
						{/each}
					</div>
					<div class="field">
						<label for="t-priority">Priority</label>
						<select id="t-priority" {...createTicket.fields.priority.as('select')}>
							<option value="">Select priority...</option>
							<option value="low">🟢 Low</option>
							<option value="medium">🟡 Medium</option>
							<option value="high">🔴 High</option>
						</select>
						{#each createTicket.fields.priority.issues() as issue (issue.message)}
							<span class="field-error">{issue.message}</span>
						{/each}
					</div>
					<div class="field">
						<label for="t-desc">Description</label>
						<textarea id="t-desc" {...createTicket.fields.description.as('text')} placeholder="Describe the issue..."></textarea>
						{#each createTicket.fields.description.issues() as issue (issue.message)}
							<span class="field-error">{issue.message}</span>
						{/each}
					</div>
					<button class="btn submit-btn" type="submit">Submit Ticket</button>
				</form>
			</div>
		</section>

		<!-- ━━━━━━━━━━ 6. COMMAND ━━━━━━━━━━ -->
		<section>
			<div class="section-header">
				<span class="badge purple">command</span>
				<div>
					<h2>Ship an Order</h2>
					<p class="what">Fire-and-forget server action</p>
				</div>
			</div>
			<p class="how">
				<code>command()</code> is for <strong>mutations</strong> — changing data on the server. Unlike <code>query</code>, commands are never cached.
				They run once and return. Click a button to mark an order as shipped.
			</p>

			<div class="card">
				<div class="cmd-buttons">
					{#each orderIds as id (id)}
						<button
							class="cmd-btn"
							disabled={shippedLoading}
							onclick={async () => {
								shippedLoading = true;
								const result = await markAsShipped(id);
								shippedResult = `Order #${result.orderId} → ${result.newStatus}`;
								shippedLoading = false;
							}}
						>
							Ship #{id}
						</button>
					{/each}
				</div>
				{#if shippedResult}
					<div class="cmd-result">
						<span class="check">✓</span> {shippedResult}
					</div>
				{/if}
			</div>
		</section>

		<footer>
			Built with <a href="https://svelte.dev/docs/kit/remote-functions">SvelteKit Remote Functions</a>
		</footer>
	</main>

	{#snippet failed(error)}
		<main>
			<div class="error-banner">
				<h2>Something went wrong</h2>
				<pre>{error}</pre>
			</div>
		</main>
	{/snippet}
</svelte:boundary>

<style>
	:global(body) {
		margin: 0;
		background: #f5f6f8;
		color: #1e1e2e;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}

	main {
		max-width: 760px;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 4rem;
	}

	/* ── Header ── */
	header { margin-bottom: 2.5rem; }
	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	header h1 { font-size: 1.75rem; font-weight: 700; margin: 0; }
	header p { font-size: 0.92rem; color: #555; line-height: 1.6; margin: 0; }

	.live-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		color: #059669;
		background: #ecfdf5;
		padding: 5px 12px;
		border-radius: 99px;
	}
	.pulse {
		width: 8px; height: 8px;
		border-radius: 50%;
		background: #10b981;
		animation: pulse 2s infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	/* ── Section ── */
	section { margin-bottom: 2.5rem; }
	.section-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.25rem;
	}
	.section-header h2 { font-size: 1.1rem; font-weight: 600; margin: 0; }
	.what { font-size: 0.82rem; color: #888; margin: 2px 0 0; }
	.how {
		font-size: 0.88rem; color: #555; line-height: 1.6;
		margin: 0.5rem 0 1rem;
	}
	.how code {
		background: #e8ecf1; padding: 1px 5px; border-radius: 3px;
		font-size: 0.8rem; color: #1e1e2e;
	}

	/* ── Badges ── */
	.badge {
		font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
		letter-spacing: 0.5px; padding: 4px 8px; border-radius: 4px;
		white-space: nowrap; margin-top: 2px; flex-shrink: 0;
	}
	.badge.blue { background: #dbeafe; color: #1d4ed8; }
	.badge.teal { background: #ccfbf1; color: #0f766e; }
	.badge.green { background: #d1fae5; color: #065f46; }
	.badge.orange { background: #ffedd5; color: #c2410c; }
	.badge.purple { background: #ede9fe; color: #6d28d9; }

	/* ── Card ── */
	.card {
		background: #fff;
		border: 1px solid #e4e7eb;
		border-radius: 10px;
		padding: 1.25rem;
		margin-bottom: 0.75rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.04);
	}

	/* ── Table ── */
	table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
	th { text-align: left; padding: 8px 10px; color: #64748b; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid #f0f1f3; }
	td { padding: 10px; border-bottom: 1px solid #f4f5f7; }
	.mono { font-family: 'JetBrains Mono', 'SF Mono', monospace; font-size: 0.82rem; }

	.status-pill {
		display: inline-block; font-size: 0.72rem; font-weight: 600;
		padding: 2px 8px; border-radius: 99px; text-transform: capitalize;
	}
	.status-pill.delivered { background: #d1fae5; color: #065f46; }
	.status-pill.shipped { background: #dbeafe; color: #1d4ed8; }
	.status-pill.processing { background: #fef3c7; color: #92400e; }

	/* ── Pill picker ── */
	.pill-picker { display: flex; gap: 6px; margin-bottom: 0.75rem; flex-wrap: wrap; }
	.pill {
		padding: 6px 14px; border-radius: 99px; border: 1px solid #d1d5db;
		background: #fff; font-size: 0.82rem; cursor: pointer; transition: all 0.15s;
		color: #374151;
	}
	.pill:hover { border-color: #93c5fd; }
	.pill.active { background: #2563eb; color: #fff; border-color: #2563eb; }

	/* ── Detail grid ── */
	.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	.detail-item { display: flex; flex-direction: column; gap: 2px; }
	.detail-label { font-size: 0.72rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.3px; }
	.detail-value { font-size: 0.92rem; }

	/* ── Team grid ── */
	.team-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
	.team-card {
		background: #fff; border: 1px solid #e4e7eb; border-radius: 10px;
		padding: 1rem; display: flex; align-items: center; gap: 0.75rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.04);
	}
	.team-card.skeleton { color: #94a3b8; font-style: italic; justify-content: center; }
	.avatar {
		width: 40px; height: 40px; border-radius: 50%; background: #dbeafe;
		color: #1d4ed8; display: flex; align-items: center; justify-content: center;
		font-weight: 700; font-size: 0.85rem; flex-shrink: 0;
	}
	.team-card strong { font-size: 0.88rem; display: block; }
	.role { font-size: 0.75rem; color: #94a3b8; }

	/* ── Live ── */
	.live-card { text-align: center; padding: 2rem; }
	.live-number {
		font-size: 3rem; font-weight: 800; color: #059669;
		font-family: 'JetBrains Mono', 'SF Mono', monospace;
		line-height: 1;
	}
	.live-label { font-size: 0.88rem; color: #64748b; margin-top: 4px; }
	.live-meta {
		display: flex; align-items: center; justify-content: center;
		gap: 8px; font-size: 0.75rem; color: #94a3b8; margin-top: 0.75rem;
	}
	.dot {
		width: 8px; height: 8px; border-radius: 50%; background: #d1d5db;
	}
	.dot.connected { background: #10b981; box-shadow: 0 0 6px #10b981; }

	/* ── Form ── */
	.ticket-form { display: flex; flex-direction: column; gap: 0.85rem; }
	.field { display: flex; flex-direction: column; gap: 4px; }
	.field label { font-size: 0.82rem; font-weight: 600; color: #475569; }
	.field input, .field textarea, .field select {
		border: 1px solid #d1d5db; border-radius: 6px; padding: 0.55rem 0.7rem;
		font-size: 0.88rem; background: #fff; color: #1e1e2e; transition: border-color 0.15s;
	}
	.field input:focus, .field textarea:focus, .field select:focus {
		outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
	}
	.field textarea { min-height: 80px; resize: vertical; }
	.field-error { font-size: 0.78rem; color: #dc2626; }

	/* ── Command ── */
	.cmd-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
	.cmd-btn {
		padding: 7px 14px; border-radius: 6px; border: 1px solid #d1d5db;
		background: #fff; color: #374151; font-size: 0.82rem;
		cursor: pointer; transition: all 0.15s;
	}
	.cmd-btn:hover:not(:disabled) { background: #ede9fe; border-color: #a78bfa; color: #6d28d9; }
	.cmd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.cmd-result {
		background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;
		padding: 0.6rem 0.85rem; font-size: 0.85rem; color: #166534;
		display: flex; align-items: center; gap: 0.5rem;
	}
	.check { font-weight: 700; color: #16a34a; }

	/* ── Buttons ── */
	.btn {
		padding: 7px 16px; border-radius: 6px; border: 1px solid #d1d5db;
		background: #fff; color: #374151; font-size: 0.85rem;
		cursor: pointer; transition: all 0.15s;
	}
	.btn:hover { background: #f1f5f9; border-color: #94a3b8; }
	.submit-btn {
		background: #2563eb; color: #fff; border-color: #2563eb; align-self: flex-start;
	}
	.submit-btn:hover { background: #1d4ed8; }

	.muted { color: #94a3b8; font-style: italic; margin: 0; }
	.error { color: #dc2626; margin: 0; }

	.error-banner {
		background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 1.5rem;
	}
	.error-banner pre { color: #991b1b; font-size: 0.82rem; white-space: pre-wrap; }

	footer {
		text-align: center; font-size: 0.8rem; color: #94a3b8;
		margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e4e7eb;
	}
	footer a { color: #2563eb; }
</style>
