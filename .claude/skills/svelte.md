# Svelte 5

> **Scope**: Svelte 5 + SvelteKit, with `experimental.async` enabled
> **Docs**: https://svelte.dev/docs
> **Required for everything async-in-markup**: opt into `compilerOptions.experimental.async: true`

This skill covers Svelte 5 runes, async-in-markup, error boundaries, snippets, and the hydration model — the parts most likely to bite you. For SvelteKit remote functions specifically, see `remote-functions.md`.

---

## Runes (the reactivity primitives)

All runes are compile-time keywords. No imports needed.

### `$state(initial)` — reactive state

```ts
let count = $state(0);
let user = $state({ name: 'Ada' }); // deeply reactive proxy
```

Mutations (`user.name = 'Bea'`) are tracked. To opt out of deep reactivity: `$state.raw(value)`.

### `$derived(expr)` / `$derived.by(fn)` — computed values

```ts
let doubled = $derived(count * 2);
let summary = $derived.by(() => {
  return `${user.name} (${count})`;
});
```

Use `$derived.by` when you need a multi-statement computation. With `experimental.async`, you can `await` inside `$derived(await fetch...)` — but for streaming sources (e.g. live queries) prefer `{await x}` directly in markup; `$derived(await x)` doesn't always re-subscribe to subsequent updates.

### `$effect(fn)` — side effects

```ts
$effect(() => {
  const id = setInterval(() => count++, 1000);
  return () => clearInterval(id);
});
```

`$effect` runs after the DOM updates. `$effect.pre` runs before. `$effect.root` creates a root effect outside a component (for libraries). `$effect.pending()` returns true when async work is in flight (only inside boundaries that have already resolved once).

### `$props()` — component props

```ts
let { title, children, ...rest } = $props();
let { value = 0 }: { value?: number } = $props();
```

### `$bindable()` — two-way bindable prop

```ts
let { value = $bindable() } = $props();
```

### `$inspect(value)` — debug

Logs whenever the tracked value changes. Strip before shipping.

---

## Async in markup (experimental)

Opt in:

```js
// svelte.config.js
compilerOptions: { experimental: { async: true } }
```

You can then `await` in three places previously unavailable: top of `<script>`, inside `$derived(...)`, and inside markup expressions.

```svelte
<p>{await loadGreeting()}</p>
{#each await getOrders() as order (order.id)}
  <p>{order.customer}</p>
{/each}
```

### `{await expr}` vs `{#await ...}` — they are NOT equivalent

| | `{#await promise}` block | `{await expr}` expression |
|---|---|---|
| SSR behavior | **Renders only the pending branch.** Promise is never awaited on the server. | Promise is awaited during SSR; resolved value is rendered into the HTML. |
| Hydration | Client refetches | Client reads serialized result via `hydratable` (no refetch) |
| When to use | Truly client-only async (no SSR equivalent) | Anything you want SSR'd or hydrated cleanly |

**This is the most common cause of `hydratable_missing_but_required`**: mixing `{#await}` with libraries that call `hydratable()` internally (like SvelteKit remote functions). The library expects a serialized value to be present, the block syntax never produced one, hydration throws.

**Fix**: convert to await expressions. Use `<svelte:boundary>` for loading states.

```svelte
<!-- Don't: -->
{#await getOrders()}
  <p>loading</p>
{:then orders}
  {#each orders as order}...{/each}
{:catch err}
  <p>{err.message}</p>
{/await}

<!-- Do: -->
<svelte:boundary>
  {#each await getOrders() as order (order.id)}...{/each}
  {#snippet failed(err)}
    <p>{err.message}</p>
  {/snippet}
</svelte:boundary>
```

---

## `<svelte:boundary>` — error and loading boundaries

```svelte
<svelte:boundary onerror={(e, reset) => log(e)}>
  <SomeAsyncComponent />

  {#snippet pending()}
    <Spinner />
  {/snippet}

  {#snippet failed(error, reset)}
    <p>Something broke: {error.message}</p>
    <button onclick={reset}>Try again</button>
  {/snippet}
</svelte:boundary>
```

- The `pending` snippet is **only** shown on first render. After that, `$effect.pending()` exposes ongoing async work for finer-grained UI.
- During SSR, **a boundary with a `pending` snippet renders the pending state and skips its async children** — meaning the data is not in the SSR HTML and the client refetches. If you want SSR data, omit the `pending` snippet (the awaits resolve before render returns).
- The `failed` snippet catches unhandled errors thrown anywhere inside the boundary, including in child `$effect`s and in awaited promises.

### Same-name snippet collisions

`failed` and `pending` are **special prop names** the boundary picks up implicitly. If you have multiple boundaries in one component each declaring a `{#snippet failed(...)}`, you'll hit `Identifier 'failed' has already been declared` (snippets compile to siblings in component scope).

**Fix**: name the snippet uniquely and pass it explicitly to the prop:

```svelte
{#snippet ordersFailed(err: unknown)}
  <p>{err instanceof Error ? err.message : String(err)}</p>
{/snippet}

<svelte:boundary failed={ordersFailed}>
  ...
</svelte:boundary>
```

---

## `{@const}` placement rules

`{@const x = ...}` must be the immediate child of one of:

- `{#if}` / `{:else if}` / `{:else}`
- `{#each}`
- `{#snippet}`
- `{:then}` / `{:catch}`
- `<svelte:fragment>`, `<svelte:boundary>`
- A component instance `<Foo>...</Foo>`

It cannot live inside arbitrary `<div>...</div>` markup. If you need a const inside a div, wrap in `<svelte:boundary>` (no DOM cost) or use a `{#snippet}` you immediately render.

---

## Hydration model & `hydratable`

Async SSR works like this:

1. Server runs `await render(App)`. Promises in markup resolve.
2. Resolved values that came from a `hydratable(key, fn)` call are serialized into a `<script>` block in `head`.
3. Client hydrates. When code re-encounters `hydratable(key, fn)`, it reads the cached value instead of re-running `fn`.

You usually don't call `hydratable` yourself — datafetching libraries (SvelteKit remote functions, query libraries) wrap their fetches in it. But understanding the contract helps debug:

- **`hydratable_missing_but_required`** during hydration → SSR didn't register a hydratable for that key. Causes:
  - SSR threw before the hydratable was registered (look for upstream errors).
  - Custom class instances in the value couldn't be serialized by devalue (need a SvelteKit `transport` hook for them).
  - `{#await}` block was used where the library expected SSR-resolved data.

- **CSP issues**: `hydratable` injects an inline `<script>`. With strict CSP, pass a `nonce` to `render()` or use hash-based CSP.

Devalue (the serializer) handles `Date`, `Map`, `Set`, `URL`, `BigInt`, regex, and your custom types via SvelteKit transport. It does **not** handle arbitrary class instances — they silently break serialization.

---

## Snippets and `{@render}`

```svelte
{#snippet row(item, idx)}
  <tr><td>{idx}</td><td>{item.name}</td></tr>
{/snippet}

<table>
  {#each items as item, i}
    {@render row(item, i)}
  {/each}
</table>
```

- Snippets close over their lexical scope.
- A component prop typed `Snippet<[Foo]>` accepts a snippet from the parent.
- `children` is just the prop name SvelteKit/component conventions use for the default slot-like content: `let { children } = $props(); {@render children?.()}`

---

## Keyed `{#each}`

Add a key when items can change identity (filter, reorder, partial update):

```svelte
{#each items as item (item.id)}
  ...
{/each}
```

Without a key, Svelte uses positional matching, which causes broken transitions, lost focus, and stale DOM state on reorder. The autofixer flags missing keys as suggestions.

---

## Common errors and what they mean

- **`hydratable_missing_but_required`** — see hydration section above.
- **`const_tag_invalid_placement`** — `{@const}` placed somewhere it isn't allowed.
- **`Identifier 'X' has already been declared`** during SSR module eval — usually two same-named `{#snippet X}` declarations in the same component. Rename one and pass it via prop.
- **`await_waterfall`** runtime warning — sequential `await` in `$derived` chain. Either accept it (deps are sequential) or use `Promise.all` / parallel `$derived` for independent values.
- **Hydration mismatch on first reload but not subsequent** — usually SSR rendered different content than client. Check for code that runs at module top level differently per render (random IDs, `Date.now()`), or for remote functions that throw on the server.

---

## Project conventions in this repo

- Runes mode is forced for app code, libraries opt out automatically (see `svelte.config.js`).
- `experimental.async: true` and `kit.experimental.remoteFunctions: true` are both on.
- The `svelte` MCP server (`.claude/CLAUDE.md` references it) provides autofixer + docs lookup; use it before sending Svelte code.
