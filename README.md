# Trader Daily Snapshot

Open positions, day P&L and a risk indicator for the authenticated trader, updated live over a tenant-scoped WebSocket. NestJS + Prisma + PostgreSQL (row-level security), Next.js + Tailwind + TanStack Query, Socket.IO.

**Time taken:** 1 hour 45 minutes.

**LLM use:** I built this with Claude Code (Claude Opus 5.5) as a pair programmer. It checked current versions (NestJS 12, Prisma 7, Next.js 16), scaffolded the repo and drafted most of the code, tests and docs. I made the calls (tenant isolation in Postgres, positions derived from fills, what to cut), reviewed every piece and ran everything end to end, including the UI in a headless browser. Two things caught in review: a lint auto-fix would have broken NestJS dependency injection at runtime, and the first version let the client send its own commission. Written alone, I would have kept the dev tooling smaller and started from a fill ledger instead of replaying history per request.

## Background

- TypeScript: 5
- Next.js: 4
- NestJS: 4
- Prisma: 3
- PostgreSQL: 5
- WebSockets: 5
- Tailwind: 4
- JWT / auth: 5
- Multi-tenant data isolation: 4
- TanStack Query: 5
- Redis / BullMQ: 5
- Docker, AWS, Pulumi: 4

1. **Strongest:** TypeScript on Node and PostgreSQL. I have shipped NestJS and Next.js services at Superbar and built InfraHub's platform from scratch, schema and CI/CD included.
2. **Steepest curve:** the domain, not the stack. Futures sessions, prop-firm risk rules and CFTC/NFA obligations are new to me.
3. **Strength outside your stack:** LLM systems in production. At Fireflies I cut AI costs about 40% with a new prompt format and took transcription from 12 to 69 languages. I also maintain an open-source TypeScript ORM, UQL.
4. **Day to day:** leading a small team while still writing a real share of the code: design, build, review, unblock.
5. **Avoid:** teams where nobody owns quality, shipping without reviews or tests and then firefighting the same bugs for months.

## Run it

Requires Node 22+, Docker and npm.

```sh
npm install
cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env.local
npm run db:up          # Postgres 17 on :55432, creates the non-owner runtime role
npm run db:migrate     # schema + RLS policies + grants
npm run db:seed        # loads dataset/ (drops the free-text notes columns)
npm run dev            # API :3001, web :3000
```

Open http://localhost:3000 and sign in. Good traders to try: **T-005** (one account above 75 risk), **T-010** (zero balance with an open position, so risk is 100), **T-011** (no fills), **T-001** (two accounts). Signing in through another broker's portal fails.

The dev panel at the bottom sends a fill through the real path (save, WebSocket, refetch). Or with curl, as in `dataset/simulate-fills.md`:

```sh
curl -c jar -H 'content-type: application/json' -d '{"brokerId":"BRK-SMPT","traderId":"T-005"}' localhost:3001/dev/login
curl -b jar -H 'content-type: application/json' \
  -d '{"account_id":"ACC-1006","instrument_symbol":"MES","side":"BUY","quantity":2,"price":5643.25}' \
  localhost:3001/dev/fills
```

Checks: `npm test`, `npm run test:e2e` (tenant isolation against the real database, over HTTP and WebSocket), `npm run typecheck`, `npm run lint`, `npm run format.check`.

## How it is put together

```
packages/contracts       wire types and constants shared by API and web
apps/api                 NestJS, hexagonal
  snapshot/domain          pure functions: CME session, position replay, risk (unit-tested, no I/O)
  snapshot/application     use cases + ports
  snapshot/infrastructure  Prisma adapters, REST controller, Socket.IO gateway, response mapping
  tenancy                  the only database handle: withTenant(scope, work)
  auth                     session JWT in an HttpOnly cookie, one authenticate() for REST and sockets
  dev                      dev login + fill simulator, not mounted unless enabled
  prisma/                  schema, migrations (incl. RLS + grants), seed
apps/web                 Next.js App Router, TanStack Query, socket.io-client
```

`GET /me/snapshot` takes the trader from the session, loads their accounts and fills in one tenant transaction, and replays the fills in the domain. Positions carry across sessions; realized P&L, commissions and counts cover today's session only. The index `(broker_id, account_id, filled_at)` fits that read: tenant first (the RLS filter), then the trader's accounts, then time.

Security and PII: see [SECURITY.md](SECURITY.md).

### Decisions on the data

- **Today is a CME session, not a UTC day.** It opens at 17:00 Chicago time, so at the dataset cut it started `2026-08-24T22:00Z`. DST-aware and tested; holidays ignored.
- **"Now" is the dataset cut** (`2026-08-25T14:30Z`), via a `Clock` that keeps ticking, so simulated fills land after the seed data.
- **Contract sizes:** P&L and notional use `point_value_usd` (ES 50 vs MES 5, NQ 20 vs MNQ 2, 6E 125,000).
- **Commissions** are per contract, per side, and come off day P&L. The rate lives on `instruments`; the server prices every fill, the client never sends one.
- **Partial fills:** maths per fill, orders counted by `order_id` ("88 fills / 80 orders").
- **Accounts:** closed ones are hidden unless they still hold a position (hiding exposure would hide risk). Zero balance with exposure is risk 100, not a divide-by-zero.
- **Money** is exact decimal everywhere and a string on the wire; floats only for display.
- **Risk** uses gross notional, so a short adds risk instead of cancelling a long. The API also returns the level (`normal`, `elevated` above 50, `high` above 75); the UI just colours it.
- **Day P&L** = realized today − today's commissions + unrealized. With no settlement prices in the data, unrealized is measured from average entry, not yesterday's settlement.

### The widget

One panel per account: Day P&L, the other figures, a risk bar that always names its level (Normal, Elevated, High), and the open positions. High risk shows up three ways: a band at the top linking to the account, a red border and "High risk" tag on the panel, and the red bar, so it never depends on colour alone (`role="alert"` for screen readers). Numbers that change after a fill flash briefly, green for good and red for bad, and the risk bar slides; all motion respects reduced-motion settings. Loading, error with retry, no accounts and flat positions all have their own state. The socket lives in one hook (`apps/web/lib/use-fill-stream.ts`) with four states: connecting, live, reconnecting, signed out.

### Reconnect behaviour

The socket only signals "something changed"; the REST snapshot is the source of truth. Every connect and reconnect triggers a refetch, so fills missed while offline are picked up, and fills within 150 ms share one refetch. While disconnected, the UI says "Reconnecting", dims the numbers and shows when they were last confirmed. When the session expires, the server closes the socket and the UI asks you to sign in again.

Where it can still be stale: on a half-open connection Socket.IO only notices at its ping timeout (about 45 s), and until then the UI says "Live". It also can't tell whether it missed anything; it just refetches. In production I would add a per-tenant fill sequence so the client detects gaps and replays only what it missed.

### WebSockets or SSE?

I used WebSockets because they are in your stack. This stream is one-way, though, so Server-Sent Events would be simpler here: they are plain HTTP, so the REST cookie guard authenticates them with no handshake code, they can run through the same-origin rewrite, and `EventSource` reconnects with `Last-Event-ID`. If the platform only pushes to clients I would evaluate SSE; once there is order entry or other client-to-server traffic, WebSockets are the right shared choice.

### What I cut

Holiday calendars, settlement-based P&L, a positions ledger, refresh tokens (the 15-minute session just ends), committed UI tests (I drove the UI in headless Chrome instead), multi-instance socket fan-out, CI config.

## Code review (Task 4)

> **Requesting changes.** Thanks for this, the shape is right and it's a quick fix, but two of these would be reportable incidents for us, so it can't merge yet. Please start with the first.
>
> **Blocking**
>
> 1. **Cross-tenant read, fix first.** `accountId` comes from the URL with no broker or owner check, so any signed-in trader can read any broker's positions just by trying ids, and ours are sequential. Take the trader from the session (`req` is already there), query `where: { id: accountId, brokerId, traderId }`, and return 404 when it's not theirs. Please add a test for another broker's trader.
> 2. **Positions in the logs.** `JSON.stringify(positions)` sends every position to the log pipeline, which more people can read and which we keep longer than the DB. Log ids and a count instead. Interpolating `accountId` raw also lets a crafted id fake log lines; structured fields fix both.
> 3. **The P&L is wrong.** It ignores the contract multiplier (an NQ point is $20, not $1), uses a mark stored on the row, which goes stale, and does arithmetic on `Decimal`s with `-` and `*`. Use the live mark and decimal maths.
> 4. **`...p` returns every column.** The next column added to `Position` leaks to the client without anyone touching this file. Map to an explicit response type.
>
> **Non-blocking**
>
> - Move the P&L maths into the service or domain so it's testable without HTTP.
> - Validate `accountId` at the boundary.
> - Skip flat positions; consider pagination.
>
> Happy to pair on the scoping fix. It's a pattern we'll reuse everywhere, so worth getting right once.

## Reflection (Task 5)

**Most proud of, and the cost.** Tenant isolation lives in the database, not just in code. The app's database role can't bypass row-level security, can't read trader PII and can only append fills, and a query that forgets the tenant gets zero rows instead of everyone's. The cost: every query must run inside `withTenant`, migrations need a separate owner role, and `psql` looks empty until you set the tenant. For a regulated multi-tenant platform I'd pay that again.

**With a second day.** A per-tenant fill sequence and a positions ledger written in the same transaction as each fill. Then the client can detect gaps and apply only what it missed, and the server stops replaying full history on every request.

**Handing it to two engineers.** First: run `npm run test:e2e`, read SECURITY.md and `tenancy/`, and put business rules in `snapshot/domain` as pure, tested functions. Not without a security review: the RLS migration and grants, the `Database` class, how sockets get their room, and explicit response mapping. Everything else is theirs to improve.
