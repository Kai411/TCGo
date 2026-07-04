# TCGo — Pokémon TCG Online Marketplace

## 🧠 Mandatory Workflow (EVERY task, no exceptions)

Before ANY action (reading files, editing, running commands, answering questions), you MUST run these two steps in order:

### Step 1 — graphify FIRST
Run `graphify query "<what you need to understand>"` when graphify-out/graph.json exists. Use `graphify explain "<concept>"` for a focused node or `graphify path "<A>" "<B>"` for relationships. This orients you in the codebase before you touch a single file. Skip it only if the task is purely conversational (no code involved).

### Step 2 — sequential-thinking SECOND
Use the `sequential-thinking` MCP tool (`sequentialthinking`) to break the task into ordered steps before acting. Every task with ≥2 steps requires this. Output the step plan, then execute step by step.

**Order is non-negotiable: graphify → sequential-thinking → act.** If you skip either, you are not oriented and not planned — stop and go back.

---

## Stack

- **Framework**: Nuxt 3 (v3.13.2) + Vue 3 (v3.5) + TailwindCSS (v3.4)
- **Backend**: Firebase (auth, Firestore), Supabase, Stripe
- **Build**: Vite + Netlify
- **Node**: >=22 (see `.nvmrc`)
- **Package manager**: npm

## Commands

```bash
npm run dev        # Start Nuxt dev server
npm run build      # Production build (Nuxt + Netlify)
npm run generate   # Static site generation
npm run preview    # Preview production build
```

## Architecture

- **Pages**: Nuxt file-based routing in `pages/` — `pages/cards/[id].vue`, `pages/auctions/[id].vue`, `pages/dashboard/buyer.vue`, etc.
- **Composables**: Shared stateful logic in `composables/` — `useAuth.ts`, `useCart.ts`, `useFirebase.ts`, `useSupabase.ts`, `useStripe.ts`, etc.
- **Components**: Reusable Vue SFCs in `components/` — `CardTile`, `SearchModal`, `OrderCard`, `ListingFilters`, etc.
- **Layouts**: `layouts/default.vue` and `layouts/landing.vue`
- **Middleware**: `middleware/new-user.global.ts` runs on every route
- **Plugins**: PWA service worker (`plugins/pwa.client.ts`)
- **Styling**: TailwindCSS with custom config at `assets/css/tailwind.css`

## Gotchas

- Netlify build strips `package-lock.json` before `npm install` to avoid Rollup native binary mismatches (see `netlify.toml` comment)
- Firebase is the primary backend; Supabase is secondary (`@supabase/supabase-js` in devDependencies)
- The project uses PWA (`@vite-pwa/nuxt`) — service worker caching can mask stale assets in local dev
- `.nvmrc` specifies Node 22 — Netlify env also pinned to 22

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
