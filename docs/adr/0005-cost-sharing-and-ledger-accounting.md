# ADR 0005: Cost-Sharing Bounds & Double-Entry Ledger

## Status
Accepted

## Context
Under Indian Motor Vehicles regulations and campus policies, non-commercial private vehicle carpooling must operate on a genuine cost-sharing model without commercial profit. Arbitrary pricing risks regulatory penalties. Additionally, payment handling requires strict accounting reconciliation.

## Decision
1. **Price Caps**: Maximum cost-per-person is capped strictly by fuel and vehicle wear formulas:
   `MaxPrice = (distance_km * fuel_cost_per_km) / (seats_offered + 1)`
2. **Double-Entry Ledger**: Monetary transitions are tracked in integer paise using balanced double-entry accounting (`ledger_accounts` and `ledger_entries`) to prevent rounding errors and unbacked balances.
3. **Escrow Flow**: Authorization occurs upon booking acceptance, capture upon trip completion, with automatic refund if the ride is cancelled by the driver.

## Consequences
- Full legal compliance with non-commercial transport standards.
- Zero floating-point rounding errors or money leakage.
