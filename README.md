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
packages/contracts   wire types shared by API and web
apps/api             NestJS, hexagonal
  snapshot/domain      pure, unit-tested maths: CME session, position replay, risk
  snapshot/...         use cases, ports, Prisma adapters, REST controller, Socket.IO gateway
  tenancy              the only database handle: withTenant(scope, work)
  auth                 HttpOnly-cookie JWT, one authenticate() for REST and sockets
  dev                  dev login + fill simulator, only mounted when enabled
apps/web             Next.js, TanStack Query, socket.io-client
```

`GET /me/snapshot` takes the trader from the session, loads their accounts and fills in one tenant transaction, and replays them in the domain. The index `(broker_id, account_id, filled_at)` matches that read: tenant first (the RLS filter), then the trader's accounts, then time. Security and PII: [SECURITY.md](SECURITY.md).

### Decisions on the data

- **Today is a CME session** (opens 17:00 Chicago), not a UTC day; "now" is the dataset cut via a ticking `Clock`.
- **Contract sizes** (`point_value_usd`) drive P&L and notional; **commissions** are per contract per side, priced by the server.
- **Positions carry over** between sessions; realized P&L, commissions and fill/order counts are today only.
- **Closed accounts** are hidden unless they still hold a position; a zero balance with exposure is risk 100.
- **Risk** uses gross notional, and the API returns the level (normal, elevated above 50, high above 75).
- **Money** is exact decimal end to end. **Day P&L** = realized − commissions + unrealized from average entry (no settlement prices in the data).

### Reconnect behaviour

The socket only signals "something changed"; the REST snapshot is the source of truth. Every connect and reconnect refetches, so fills missed while offline are picked up. While disconnected the UI says "Reconnecting", dims the numbers and shows when they were last confirmed.

Where it can still be stale: on a half-open connection Socket.IO only notices at its ping timeout (about 45 s), and until then the UI says "Live". It also can't tell what it missed; it just refetches. Next step: a per-tenant fill sequence so the client detects gaps. For a one-way feed like this, SSE would also fit (cookie auth, `Last-Event-ID` replay); I kept WebSockets because they're in your stack.

### What I cut

Holiday calendars, settlement-based P&L, a positions ledger, refresh tokens, committed UI tests, multi-instance socket fan-out, CI.

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
