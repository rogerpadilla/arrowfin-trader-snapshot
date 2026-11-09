# Security and PII

The threat I designed against: a signed-in trader of one broker (or a script with their cookie) trying to see another broker's data, and our own code, months from now, accidentally letting them.

## 1. Auth model

- **REST.** `POST /dev/login` stands in for each white-label portal's identity provider. It issues an HS256 JWT (`sub` = trader, `brk` = broker, 15-minute expiry, fixed issuer and audience) in an `HttpOnly; SameSite=Strict` cookie ([session-cookie.ts:11-12](apps/api/src/auth/session-cookie.ts#L11-L12)), so page scripts can't read it. The web app reaches the API through a same-origin rewrite ([next.config.ts](apps/web/next.config.ts)), so there is no CORS to get wrong. A global guard checks every route unless it is marked `@Public()` ([session.guard.ts:39](apps/api/src/auth/session.guard.ts#L39)).
- **WebSocket.** Checked once, at the handshake, before any event ([fills.gateway.ts:66](apps/api/src/snapshot/infrastructure/fills.gateway.ts#L66)), by the same `authenticate()` as REST ([session-cookie.ts:24](apps/api/src/auth/session-cookie.ts#L24)). Browsers don't apply CORS to WebSockets, so the `Origin` header is checked against an allowlist ([bootstrap.ts:22](apps/api/src/bootstrap.ts#L22)); with `SameSite=Strict` that stops cross-site WebSocket hijacking. The server closes the socket when the token expires ([fills.gateway.ts:82](apps/api/src/snapshot/infrastructure/fills.gateway.ts#L82)).
- **Why you can't subscribe to another tenant.** There is no subscribe message. The server puts each socket in one room, `broker:{brk}:trader:{sub}`, taken from the verified token ([fills.gateway.ts:80](apps/api/src/snapshot/infrastructure/fills.gateway.ts#L80)), and publishes to the room of the caller who owns the fill. An e2e test connects three sockets (owner, same broker, other broker) and checks only the owner gets the fill.

## 2. Tenant isolation

Three layers, so no single forgotten line leaks data:

1. **Identity, not input.** `GET /me/snapshot` has no ids in the URL ([snapshot.controller.ts:9](apps/api/src/snapshot/infrastructure/snapshot.controller.ts#L9)). Repository methods require the trader, and queries filter on broker and trader ([prisma-trading.repository.ts:43](apps/api/src/snapshot/infrastructure/prisma-trading.repository.ts#L43)).
2. **One way into the database.** `Database` offers `withTenant(scope, work)` and a reference-data client that can only see instruments and prices ([database.ts:30-40](apps/api/src/tenancy/database.ts#L30-L40)). `withTenant` runs the work in one transaction that first sets `app.broker_id` ([database.ts:35](apps/api/src/tenancy/database.ts#L35)); the setting dies with the transaction, so pooled connections never leak a tenant.
3. **Postgres row-level security** on brokers, traders, accounts and fills, forced, for a runtime role that is neither owner nor `BYPASSRLS` ([RLS migration](apps/api/prisma/migrations/20261109203500_row_level_security/migration.sql)). Fills also refuse writes into another tenant (`WITH CHECK`), and composite foreign keys make a cross-tenant link impossible ([schema.prisma:164](apps/api/prisma/schema.prisma#L164)).

**If someone forgets `WHERE broker_id = ?`:** RLS still filters. If they go around `Database` altogether, no tenant is set and every policy matches nothing: zero rows, not everyone's. Both cases are e2e-tested against the real database ([tenant-isolation.e2e-spec.ts](apps/api/test/tenant-isolation.e2e-spec.ts)). The remaining gap is a new table added without a policy; a CI check for that is next.

## 3. PII handling

- **Sensitive:** names, email, phone, date of birth, `ssn_last4`, address, KYC status, balances, and above all the free-text `notes` / `audit_notes`, which contain a bank account, SSN digits, a passport-scan S3 path, a spouse's phone and compliance case ids.
- **Never loaded:** `notes` and `audit_notes`. Free text can't be reliably redacted, and this feature doesn't need it ([seed.ts:46](apps/api/prisma/seed.ts#L46)). It belongs in a separate audited store.
- **Stored but unreadable by the app:** the runtime role only gets `id, broker_id, kyc_status` on `traders` ([migration.sql:29](apps/api/prisma/migrations/20261109203500_row_level_security/migration.sql#L29)). A bug or a careless `include` gets `permission denied`, not PII.
- **On the wire:** explicit field-by-field responses, never spread rows ([snapshot.view.ts](apps/api/src/snapshot/infrastructure/snapshot.view.ts)). No names or contact data, only the last four of the account number ([snapshot.view.ts:14](apps/api/src/snapshot/infrastructure/snapshot.view.ts#L14)); balances only to their owner, `Cache-Control: no-store`.
- **Logs:** structured JSON with ids only. No bodies, query results, cookies or tokens, and no request logger that could capture them.
- **DB vs WebSocket:** at rest the controls are access controls (RLS, column grants, and KMS column encryption in production). Over the socket the data leaves our control, so the rule is minimise: the fill event has seven fields and no balance or P&L ([snapshot.view.ts:48](apps/api/src/snapshot/infrastructure/snapshot.view.ts#L48)). A test pins that exact shape.

## 4. A vulnerability I didn't introduce: IDOR

The Task 4 PR is the classic case: `GET positions/:accountId` trusts the id, and ours are sequential. Here the read route takes no id at all ([snapshot.controller.ts:9](apps/api/src/snapshot/infrastructure/snapshot.controller.ts#L9)). The only route that takes an account id (dev fills) looks it up inside the caller's own book ([record-fill.ts:35](apps/api/src/snapshot/application/record-fill.ts#L35), [prisma-trading.repository.ts:84](apps/api/src/snapshot/infrastructure/prisma-trading.repository.ts#L84)) and answers 404, not 403, so it can't be used to probe which ids exist. Delete that check and RLS still returns nothing and refuses the insert. Both another tenant's and a same-tenant colleague's account are e2e-tested.

Also: **JWT algorithm downgrade.** Verification pins `HS256`, issuer and audience ([session-token.ts:41](apps/api/src/auth/session-token.ts#L41)), so `alg: none` or a token for another service fails. Unit and e2e tested.

**Why `/dev/*` can't run in production:** the module isn't even imported unless `ENABLE_DEV_TOOLS=true` ([app.module.ts:15](apps/api/src/app.module.ts#L15)), and the app refuses to boot with that flag plus `NODE_ENV=production` ([app-config.ts:24](apps/api/src/config/app-config.ts#L24), tested). Off by default, and even on it only touches the caller's own accounts.

## 5. What I'd do in production

OIDC per white-label portal, with the issuer bound to the broker. Short access tokens with refresh rotation and server-side revocation, so a suspended trader (T-008) is cut off at once. Rate limits per trader and IP in Redis, and a cap on sockets per trader. An append-only audit log of every PII or balance read, kept for CFTC/NFA record-keeping. KMS-encrypted columns for `ssn_last4`, `dob` and address. Log redaction as a backstop, a nonce-based CSP, managed and rotated secrets with asymmetric signing, the Socket.IO Redis adapter for multiple instances, and a CI check that every `broker_id` table has a policy.
