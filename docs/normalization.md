# Normalization (1NF → 3NF)

## 1NF — Atomic columns, no repeating groups
Each column stores a single value. No comma-separated lists, no JSON
arrays for relational data. Multi-valued data lives in child tables
(transactions, transfers, loan_payments, bill_payments).

## 2NF — No partial dependencies
All non-key columns depend on the **whole** primary key. We use
single-column UUID surrogates as primary keys, so 2NF is satisfied by
construction.

## 3NF — No transitive dependencies
Non-key columns depend only on the primary key, not on other non-key
columns. Examples:

- `profiles` holds user attributes; account balances are NOT denormalized
  onto it. Balance lives only on `accounts`.
- `transactions.balance_after` is technically derived, but it is stored
  intentionally as an immutable snapshot for the receipt. This is a
  deliberate, well-understood denormalization for auditability — every
  other column is in 3NF.
- Customer name is stored only in `profiles`; we look it up via JOIN
  when rendering receipts (`get_receipt`).
- Account type discriminates `savings` vs `current`; per-type behaviour
  lives in code (`SavingsAccount.calculateInterest`,
  `CurrentAccount.calculateInterest`), not in extra columns.

## Constraints that enforce integrity
- `CHECK` on `accounts.balance >= 0`, `amount > 0`, enum-style status.
- `UNIQUE` on `accounts.account_number`.
- `FOREIGN KEY ... ON DELETE CASCADE` from child tables to parents.
- RLS policies that restrict every row to its owner via `auth.uid()`.