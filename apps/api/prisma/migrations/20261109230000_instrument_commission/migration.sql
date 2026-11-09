-- The fee schedule is reference data: the server prices a fill's commission, the client never supplies it.
ALTER TABLE "instruments" ADD COLUMN "commission_per_contract_usd" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "instruments" ALTER COLUMN "commission_per_contract_usd" DROP DEFAULT;
