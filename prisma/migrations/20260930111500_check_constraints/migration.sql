-- Database-level guarantees that back up the trading engine's invariants.
-- Even if application code had a bug, Postgres would refuse to commit a
-- transaction that leaves a portfolio with negative cash or shares.

ALTER TABLE "Portfolio"
  ADD CONSTRAINT "portfolio_cash_non_negative" CHECK ("cashCents" >= 0),
  ADD CONSTRAINT "portfolio_fees_non_negative" CHECK ("feesPaidCents" >= 0),
  ADD CONSTRAINT "portfolio_trade_count_non_negative" CHECK ("tradeCount" >= 0);

ALTER TABLE "Holding"
  ADD CONSTRAINT "holding_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "holding_cost_basis_non_negative" CHECK ("costBasisCents" >= 0);

ALTER TABLE "Trade"
  ADD CONSTRAINT "trade_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "trade_price_positive" CHECK ("priceCents" > 0),
  ADD CONSTRAINT "trade_fee_non_negative" CHECK ("feeCents" >= 0);

ALTER TABLE "League"
  ADD CONSTRAINT "league_starting_cash_positive" CHECK ("startingCashCents" > 0),
  ADD CONSTRAINT "league_fees_non_negative" CHECK ("feeFlatCents" >= 0 AND "feeBps" >= 0),
  ADD CONSTRAINT "league_dates_ordered" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");
