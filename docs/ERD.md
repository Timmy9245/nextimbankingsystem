# Entity-Relationship Diagram

```
              ┌────────────────────┐
              │     auth.users     │
              │  (Supabase auth)   │
              └─────────┬──────────┘
                        │ 1
                        │
              ┌─────────▼──────────┐         ┌──────────────────────┐
              │     profiles       │         │     fraud_alerts     │
              │ id (PK,FK)         │         │ customer_id          │
              │ full_name          │         │ reason, details      │
              │ phone, pin_hash    │         └──────────────────────┘
              └─────────┬──────────┘
                        │ 1
                        │ N
              ┌─────────▼──────────┐
              │     accounts       │
              │ id (PK)            │
              │ customer_id (FK)   │
              │ account_number U   │
              │ account_type       │
              │ balance, status    │
              └──┬──────┬──────┬───┘
                 │1     │1     │1
                 │N     │N     │N
   ┌─────────────▼──┐ ┌─▼───────────┐ ┌─▼──────────────┐
   │  transactions  │ │  transfers  │ │ bill_payments  │
   │ account_id FK  │ │ from/to     │ │ account_id FK  │
   │ type, amount   │ │ amount, ref │ │ category, ref  │
   │ balance_after  │ └─────────────┘ └────────────────┘
   └────────────────┘

   ┌──────────┐    1   N   ┌────────────────┐
   │  loans   │────────────▶│ loan_payments │
   └──────────┘            └────────────────┘

   ┌──────────────┐
   │  audit_logs  │  ← written by audit_trigger() on accounts + transactions
   └──────────────┘
```

Relationships:
- `profiles.id` 1:1 `auth.users.id`
- `accounts.customer_id` N:1 `auth.users.id`
- `transactions.account_id` N:1 `accounts.id`
- `transfers.from_account` / `to_account` N:1 `accounts.id`
- `bill_payments.account_id` N:1 `accounts.id`
- `loans.account_id` N:1 `accounts.id`
- `loan_payments.loan_id` N:1 `loans.id`