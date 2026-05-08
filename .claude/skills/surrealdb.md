# SurrealDB JS SDK (v2.x)

> **Package**: `surrealdb` (with optional `@surrealdb/node` for in-process engines)
> **Docs**: https://surrealdb.com/docs/sdk/javascript
> **Types**: Full TypeScript definitions in `node_modules/surrealdb/dist/surrealdb.d.ts`

## What's in the SDK

The SDK is fully typed. Everything is exported from `surrealdb`.

**Core**

- `Surreal` — main client (extends `SurrealSession` extends `SurrealQueryable`)
- `SurrealTransaction` — typed transaction wrapper
- `ConnectOptions`, `DriverOptions`, `CodecOptions`, `ReconnectOptions`

**Query construction**

- `db.query<R extends unknown[]>(sql, bindings?)` — returns `Query<R>` (awaitable, `.collect()`, `.responses()`, `.stream()`, `.json()`)
- `BoundQuery<R>` — pre-bound, statically typed query
- `surql\`...\`` template tag — auto-binds interpolated values, returns `BoundQuery`
- `s\`...\``, `d\`...\``, `r\`...\``, `u\`...\`` — string / DateTime / StringRecordId / Uuid template tags

**Typed CRUD on `Surreal`**

- `db.select<T>(target)` → `RecordResult<T>` or `RecordResult<T>[]`
- `db.create<T>(target).content({...})` → `RecordResult<T>`
- `db.insert<T>(table, data)`, `db.update<T>(...)`, `db.merge<T>(...)`, `db.upsert<T>(...)`, `db.delete<T>(...)`
- `db.relate<T>(from, edge, to, data?)`
- Each accepts `RecordId`, `RecordIdRange`, or `Table` — overloads narrow the return type

**Live queries**

- `db.live<T>(what)` → `ManagedLivePromise<T>`
- `LiveSubscription`, `ManagedLiveSubscription`, `UnmanagedLiveSubscription`
- `LiveMessage`, `LiveAction` (`'CREATE' | 'UPDATE' | 'DELETE' | ...`)

**Value classes (extend `Value`)**

- `RecordId<TName, TVal>` — `.table` returns `Table<TName>`, `.id` returns the inner value, `.toString()` returns escaped `table:id`, `.toJSON()` returns string form
- `Table<Tb>` — `.name` returns the unescaped table name
- `StringRecordId`, `Uuid`, `Duration`, `DateTime`, `Decimal`, `FileRef`, `Future`
- Geometry: `GeometryPoint`, `GeometryLine`, `GeometryPolygon`, `GeometryMultiPoint`, `GeometryMultiLine`, `GeometryMultiPolygon`, `GeometryCollection`
- Range bounds: `BoundIncluded<T>`, `BoundExcluded<T>`, `Bound<T>`

**Helper types**

- `RecordResult<T>` — wraps a record so `id` is typed as `RecordId`. If `T.id` is already a `RecordId`, returned as-is; if it's a `RecordIdValue` primitive, it's promoted to `RecordId<string, T['id']>`.
- `Values<T> = Partial<T> & Record<string, unknown>` — input shape for create/update content
- `AnyRecordId<Tb, Id>` — union of `RecordId` + `StringRecordId`
- `RecordIdValue = string | number | Uuid | bigint | unknown[] | Record<string, unknown>`
- `Jsonify<T>`, `jsonify<T>()` — for serialization without SurrealDB types

**Expression builders** (composable, used with `where()`, `expr()`)

- `eq`, `eeq`, `ne`, `gt`, `gte`, `lt`, `lte`
- `contains`, `containsAny`, `containsAll`, `containsNone`
- `inside`, `outside`, `intersects`, `matches`, `knn`, `between`
- `and`, `or`, `not`, `expr`, `raw`

**Errors (full hierarchy)**

- Base: `SurrealError`
- Server: `ServerError`, `QueryError`, `ValidationError`, `ThrownError`, `NotFoundError`, `NotAllowedError`, `AlreadyExistsError`, `SerializationError`, `ConfigurationError`, `InternalError`
- Client: `AuthenticationError`, `LiveSubscriptionError`, `UnsupportedFeatureError`, `InvalidRecordIdError`, `InvalidTableError`, `ReconnectExhaustionError`, `HttpConnectionError`, `ConnectionUnavailableError`, `MissingNamespaceDatabaseError`
- `ErrorKind` enum + typed detail types: `QueryErrorDetail`, `AuthErrorDetail`, `ValidationErrorDetail`, `NotFoundErrorDetail`, `AlreadyExistsErrorDetail`

**Misc**

- `Features` — feature flags
- `MINIMUM_VERSION` / `MAXIMUM_VERSION`, `isVersionSupported()`
- `escapeIdent`, `escapeNumber`, `escapeIdPart`, `escapeRangeBound`, `toSurqlString`
- `mergeBindings`, `equals`

---

## Connection setup

```ts
import { Surreal, createRemoteEngines } from 'surrealdb';
import { createNodeEngines } from '@surrealdb/node';

const db = new Surreal({
  engines: {
    ...createRemoteEngines(),
    ...createNodeEngines()
  },
  codecOptions: {
    useNativeDates: true // returns native Date objects (loses ns precision)
  }
});

await db.connect('ws://127.0.0.1:8000/rpc', {
  namespace: 'app',
  database: 'main',
  authentication: { username: 'root', password: 'secret' },
  reconnect: { enabled: true }
});
```

`createRemoteEngines()` covers `ws://`/`wss://`/`http://`/`https://`. `createNodeEngines()` adds in-process engines like `mem://` and embedded RocksDB — useful for tests.

---

## CodecOptions

```ts
interface CodecOptions {
  useNativeDates?: boolean;                          // Date instead of DateTime class
  valueEncodeVisitor?: (value: unknown) => unknown;  // before encode
  valueDecodeVisitor?: (value: unknown) => unknown;  // after decode
}
```

**Pitfall**: writing a `valueDecodeVisitor` that flattens `RecordId` to a primitive (so `id: number`) is tempting for ergonomics, but it makes runtime types diverge from SDK types, breaks `RecordResult<T>`, and breaks transport hooks. Prefer keeping `RecordId` as-is and using `id.id` / `id.toString()` at call sites — or set up a SvelteKit `transport` hook (see below).

---

## Idiomatic patterns

```ts
import { RecordId, Table, surql, type RecordResult } from 'surrealdb';

type Order = RecordResult<{
  id: RecordId<'orders', number>;
  customer: string;
  total: number;
  status: 'delivered' | 'shipped' | 'processing';
  created_at: Date; // matches useNativeDates
}>;

// 1) Multi-statement query, typed result tuple
const [orders, count] = await db.query<[Order[], number]>(surql`
  SELECT * FROM orders ORDER BY created_at DESC LIMIT 50;
  RETURN count(orders);
`);

// 2) Single-record fetch — typed select
const order = await db.select<Order>(new RecordId('orders', 1001));
// order: RecordResult<Order> | undefined

// 3) Whole-table fetch
const all = await db.select<Order>(new Table('orders'));

// 4) Typed update with merge (Partial<Order> enforced)
await db.update<Order>(new RecordId('orders', 1001))
  .merge({ status: 'shipped' });

// 5) Typed create with content
const [created] = await db.create<Order>(new Table('orders')).content({
  customer: 'Alice',
  total: 99,
  status: 'processing',
  created_at: new Date()
});

// 6) Live subscription
const sub = await db.live<Order>(new Table('orders'));
for await (const msg of sub) {
  // msg.action: 'CREATE' | 'UPDATE' | 'DELETE'
  // msg.result: Order
}
```

### `surql` template tag — when it works, when it doesn't

`surql` interpolates values as auto-named bindings. Works great for scalars, `RecordId`, `Date`, `Uuid`:

```ts
await db.query<[Order[]]>(surql`
  SELECT * FROM orders WHERE id = ${new RecordId('orders', id)} LIMIT 1
`);
```

**Known sharp edge**: `WHERE id IN ${arrayOfRecordIds}` — the array binding sometimes doesn't produce a working `IN` clause for `RecordId[]`. If it fails, fall back to plain string + bindings:

```ts
await db.query<[TeamMember[]]>(
  'SELECT * FROM team_members WHERE id IN $ids',
  { ids: ids.map((id) => new RecordId('team_members', id)) }
);
```

---

## Using SurrealDB with SvelteKit remote functions

**Required**: register a `transport` for `RecordId` in `src/hooks.ts`. Without it, devalue (the serializer remote functions use) silently fails to encode `RecordId` instances and you get `hydratable_missing_but_required` on hydration with no clear error in the network tab.

```ts
// src/hooks.ts
import type { Transport } from '@sveltejs/kit';
import { RecordId } from 'surrealdb';

export const transport: Transport = {
  RecordId: {
    encode: (value) => value instanceof RecordId && [value.table.name, value.id],
    decode: ([table, id]) => new RecordId(table as string, id as number | string)
  }
};
```

If you also return `Decimal`, `Duration`, `Uuid`, `Table`, `StringRecordId`, etc., add transporters for each — anything that's a class instance with custom semantics needs one.

**Connection caching pattern** for `.remote.ts`:

```ts
// src/lib/server/db.ts
import { Surreal, createRemoteEngines } from 'surrealdb';
import { createNodeEngines } from '@surrealdb/node';

let instance: Surreal | null = null;
let lastUrl: string | null = null;

export async function getDb(env: { /* SURREAL_URL, etc. */ }): Promise<Surreal> {
  if (instance && lastUrl === env.SURREAL_URL) return instance;
  if (instance) { await instance.close(); instance = null; }

  const db = new Surreal({
    engines: { ...createRemoteEngines(), ...createNodeEngines() },
    codecOptions: { useNativeDates: true }
  });
  await db.connect(env.SURREAL_URL, { /* ... */ });
  instance = db;
  lastUrl = env.SURREAL_URL;
  return instance;
}
```

Call from a remote function only after `getRequestEvent()` to ensure request context.

---

## Things to remember

- `RecordId#id` is the inner value (number/string/etc.), `RecordId#table` is a `Table` (use `.name` for the string).
- `db.query` returns a `Query<R>` — it's awaitable and resolves to a tuple. Each tuple element is the result array of one statement in the SQL.
- For `INSERT ... RETURN id`, type the result as `[{ id: RecordId<'tbl', T> }[]]`, not the full row.
- Errors are class instances — `instanceof QueryError`, `instanceof NotFoundError`, etc., is reliable.
- `useNativeDates: true` is convenient but loses nanosecond precision; omit it if you need full fidelity (use `DateTime` class).
- `db.live(...)` is a managed subscription — it disconnects when no consumer is iterating; pair it with SvelteKit `query.live` for streaming queries to clients.
- `Values<T> = Partial<T> & Record<string, unknown>` — the partial is enforced for `.content()` / `.merge()`, but the index signature lets unknown extra fields through; rely on your type, don't expect strict excess-property checking.
