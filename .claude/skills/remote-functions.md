# SvelteKit Remote Functions

> **Status**: Experimental (requires opt-in flags)
> **Docs**: https://svelte.dev/docs/kit/remote-functions
> **Requires**: Svelte 5 with `experimental.async` + `experimental.remoteFunctions`

## What Are Remote Functions?

Remote functions let you write server-only code in `.remote.ts` files and call them from the client as if they were normal functions. SvelteKit transforms the imports into `fetch()` calls under the hood, targeting `/_app/remote/<hash>/data`.

**Key benefit**: No API routes, no fetch boilerplate, no manual serialization. Just import and call.

---

## Configuration

### svelte.config.js

```js
const config = {
  compilerOptions: {
    experimental: {
      async: true // Required for await-in-template
    }
  },
  kit: {
    experimental: {
      remoteFunctions: true
    }
  }
};
```

Both flags are required. `async: true` enables `{await expression}` syntax in Svelte templates.

---

## File Convention

Remote function files must use the `.remote.ts` suffix and live in `src/routes/`:

```
src/routes/data.remote.ts        ← available to +page.svelte in the same directory
src/routes/admin/data.remote.ts  ← available to routes under /admin
```

Import from the client:

```svelte
<script lang="ts">
  import { myQuery } from './data.remote';
</script>
```

---

## The 6 Remote Function Types

All imports come from `$app/server`.

### 1. `query(fn)` — Basic Data Fetching

Fetches data from the server. Cached and deduplicated automatically.

```ts
// data.remote.ts
import { query } from '$app/server';

export const getOrders = query(async () => {
  // This runs on the server only
  return db.select().from(orders);
});
```

```svelte
<!-- +page.svelte -->
{#each await getOrders() as order}
  <p>{order.name}</p>
{/each}

<button onclick={() => getOrders().refresh()}>Refresh</button>
```

**Key points:**
- Result is cached — calling `getOrders()` multiple times won't duplicate requests
- Call `.refresh()` to re-fetch from the server
- Use `await` directly in template (requires `experimental.async`)

---

### 2. `query(schema, fn)` — Query with Validated Arguments

Pass a [Standard Schema](https://standardschema.dev/) (Valibot, Zod, ArkType) to validate the input before the server function runs.

```ts
import { query } from '$app/server';
import * as v from 'valibot';

export const getOrderById = query(v.number(), async (id) => {
  const order = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new Error('Not found');
  return order;
});
```

```svelte
<script lang="ts">
  let selectedId = $state(1);
</script>

<!-- Reactively re-fetches when selectedId changes -->
{#await getOrderById(selectedId)}
  <p>Loading...</p>
{:then order}
  <p>{order.name}</p>
{:catch err}
  <p>{err.message}</p>
{/await}
```

**Key points:**
- The query automatically re-runs when arguments change (reactive)
- Invalid input is rejected before hitting the server

---

### 3. `query.batch(schema, fn)` — Batched Queries (N+1 Solution)

Multiple individual calls are combined into a single server request.

```ts
import { query } from '$app/server';
import * as v from 'valibot';

export const getUserById = query.batch(v.number(), async (ids) => {
  // `ids` is an array of ALL requested IDs
  // In a real app: SELECT * FROM users WHERE id IN (...)
  const users = await db.select().from(users).where(inArray(users.id, ids));
  const lookup = new Map(users.map(u => [u.id, u]));
  // Return a lookup function
  return (id: number) => lookup.get(id);
});
```

```svelte
<!-- These 4 calls become 1 server request -->
{#each [1, 2, 3, 4] as id}
  {#await getUserById(id) then user}
    <p>{user.name}</p>
  {/await}
{/each}
```

**Key points:**
- The server function receives ALL IDs at once as an array
- Must return a **lookup function** `(id) => result`
- SvelteKit batches calls made in the same render cycle

---

### 4. `query.live(fn*)` — Real-Time Streaming

Uses an async generator to push values to the client continuously.

```ts
import { query } from '$app/server';

export const getLiveVisitors = query.live(async function* () {
  while (true) {
    const count = await getVisitorCount();
    yield { count, updatedAt: new Date().toISOString() };
    await new Promise(r => setTimeout(r, 2000));
  }
});
```

```svelte
<script lang="ts">
  const visitors = getLiveVisitors();
</script>

{#await visitors then v}
  <p>{v.count} visitors</p>
{/await}

<p>Status: {visitors.connected ? 'Connected' : 'Disconnected'}</p>
<button onclick={() => visitors.reconnect()}>Reconnect</button>
```

**Key points:**
- The return value has `.connected` (boolean) and `.reconnect()` method
- No `.refresh()` — data arrives automatically
- **Serialization**: Yield plain objects/strings, NOT `Date` objects (they don't serialize across the wire)
- **Cloudflare Workers limitation**: Workers have execution duration limits (~30s), so the stream will disconnect. Use `.reconnect()` to handle this.

---

### 5. `form(schema, fn)` — Server-Validated Forms

Creates a progressively-enhanced form with schema validation.

```ts
import { form } from '$app/server';
import * as v from 'valibot';

export const createTicket = form(
  v.object({
    subject: v.pipe(v.string(), v.nonEmpty('Subject is required')),
    priority: v.picklist(['low', 'medium', 'high']),
    description: v.pipe(v.string(), v.nonEmpty('Required'))
  }),
  async ({ subject, priority, description }) => {
    await db.insert(tickets).values({ subject, priority, description });
    return { ticketId: 1234 };
  }
);
```

```svelte
<form {...createTicket}>
  <input {...createTicket.fields.subject.as('text')} />
  {#each createTicket.fields.subject.issues() as issue}
    <span class="error">{issue.message}</span>
  {/each}

  <select {...createTicket.fields.priority.as('select')}>
    <option value="low">Low</option>
    <option value="medium">Medium</option>
    <option value="high">High</option>
  </select>

  <textarea {...createTicket.fields.description.as('text')}></textarea>

  <button type="submit">Submit</button>
</form>
```

**Key points:**
- Spread `{...formName}` on `<form>` and `{...formName.fields.name.as('text')}` on inputs
- For `<select>`, use `.as('select')`
- Call `.issues()` on each field for validation errors
- Works **without JavaScript** (progressive enhancement)
- No `onsubmit` handler needed

---

### 6. `command(schema?, fn)` — Fire-and-Forget Mutations

For write operations. Unlike queries, commands are never cached or deduplicated.

```ts
import { command } from '$app/server';
import * as v from 'valibot';

export const markAsShipped = command(v.number(), async (orderId) => {
  await db.update(orders).set({ status: 'shipped' }).where(eq(orders.id, orderId));
  return { orderId, newStatus: 'shipped' };
});
```

```svelte
<button onclick={async () => {
  const result = await markAsShipped(orderId);
  console.log(result.newStatus);
}}>
  Ship Order
</button>
```

**Key points:**
- Schema is optional for commands
- Commands always execute — no caching
- Ideal for: delete, update, toggle, send email, etc.

---

## Architecture: Cloudflare Worker vs Static Build

### Same-Origin (adapter-cloudflare) — Simple

When using `adapter-cloudflare`, everything runs on the same origin. Remote function calls go directly to `/_app/remote/<hash>/data` on the same worker. **No proxy needed.**

```
Client → /_app/remote/q5s0im/data → Same Worker → Execute
```

### Cross-Origin (adapter-static) — Needs Proxy

When the frontend is built statically and hosted on a different domain (e.g., GitHub Pages, S3), `/_app/remote/` doesn't exist on the static host. You need a proxy bridge.

#### Request Flow

```
Client (static host)
  → Service Worker intercepts /_app/remote/*
  → Forwards to https://worker.example.com/proxy-remote/*
  → Worker strips origin header
  → Internal fetch to /_app/remote/* on same worker
  → Response flows back
```

#### Required Files

**1. Service Worker** (`src/service-worker.ts`) — intercepts and proxies only when on a different origin:

```ts
const WORKER = 'https://your-worker.workers.dev';

// Only proxy if NOT on the worker origin (i.e., on a static host)
if (url.pathname.startsWith('/_app/remote/') && url.origin !== WORKER) {
  // Proxy to worker...
}
```

**2. Proxy Route** (`src/routes/proxy-remote/[...path]/+server.ts`) — strips origin header:

```ts
export const fallback: RequestHandler = async ({ params, request, url, fetch }) => {
  const headers = new Headers(request.headers);
  headers.delete('origin');
  headers.delete('host');
  const res = await fetch(`/_app/remote/${params.path}${url.search}`, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
  });
  const out = new Response(res.body, res);
  out.headers.set('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
  return out;
};
```

**3. CORS Hook** (`src/hooks.server.ts`) — handles preflight:

```ts
export const handle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('origin');
  if (event.request.method === 'OPTIONS') {
    return new Response(null, { headers: cors(origin) });
  }
  const response = await resolve(event);
  // Add CORS headers to all responses
  return response;
};
```

#### Build Toggle

Use an environment variable to switch between adapters:

```js
// svelte.config.js
const isStatic = !!process.env.BUILD_STATIC;
adapter: isStatic ? staticAdapter({ fallback: 'index.html' }) : cloudflareAdapter()
```

---

## Gotchas & Tips

### Serialization
- Remote functions serialize data as JSON over the wire
- **Don't yield/return `Date` objects** — use `.toISOString()` and parse on the client
- Functions, Maps, Sets, etc. won't survive serialization

### Service Worker Caching
- Don't let the service worker cache `/_app/remote/` responses
- Only cache static assets (`build` and `files` from `$service-worker`)

### query.live on Cloudflare Workers
- CF Workers have execution duration limits (~30s free, longer on paid plans)
- The live stream WILL disconnect — always show `.connected` status and a `.reconnect()` button
- Consider using longer intervals (2-5s) to get more updates per connection

### form Progressive Enhancement
- Forms work without JS — the schema validates server-side and returns errors
- With JS, forms submit via fetch and update errors reactively
- Always use `.as('text')` for inputs and `.as('select')` for selects

### CSRF
- When using cross-origin proxy, set `csrf: { checkOrigin: false }` in SvelteKit config
- The proxy strips the `origin` header to bypass SvelteKit's built-in check
- **In production**: restrict CORS to your specific static site origin instead of `*`
