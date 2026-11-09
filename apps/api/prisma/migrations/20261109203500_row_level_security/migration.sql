-- Tenant isolation enforced by the database, under the application's own scoping.
-- The runtime role (arrowfin_app) is not the table owner and has no BYPASSRLS; FORCE makes the owner obey the policies too.
-- Every request runs `set_config('app.broker_id', <tenant>, true)` inside its transaction (src/tenancy/tenant-prisma.ts).
-- An unset or empty setting matches no row: a query that forgets its tenant returns nothing instead of everything.

CREATE FUNCTION current_broker_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.broker_id', true), '') $$;

ALTER TABLE brokers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers  FORCE ROW LEVEL SECURITY;
ALTER TABLE traders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE traders  FORCE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE fills    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fills    FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON brokers  USING (id = current_broker_id());
CREATE POLICY tenant_isolation ON traders  USING (broker_id = current_broker_id());
CREATE POLICY tenant_isolation ON accounts USING (broker_id = current_broker_id());
CREATE POLICY tenant_isolation ON fills    USING (broker_id = current_broker_id()) WITH CHECK (broker_id = current_broker_id());

-- Least privilege. Reference data is global and read-only. Only fills can be written (append-only, no UPDATE/DELETE).
-- Trader PII columns (name, email, phone, dob, ssn_last4, address) are not granted at all: the runtime role cannot read them.
GRANT USAGE ON SCHEMA public TO arrowfin_app;
GRANT SELECT ON instruments, market_prices TO arrowfin_app;
GRANT SELECT ON brokers, accounts TO arrowfin_app;
GRANT SELECT (id, broker_id, kyc_status) ON traders TO arrowfin_app;
GRANT SELECT, INSERT ON fills TO arrowfin_app;
GRANT EXECUTE ON FUNCTION current_broker_id() TO arrowfin_app;
