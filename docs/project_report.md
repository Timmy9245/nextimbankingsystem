# NexTim — Project Report

## 1. Overview
NexTim is a campus banking web app that lets a customer:
- Open savings or current accounts
- Deposit, withdraw, and transfer funds
- Pay bills (Airtime/Data, Electricity, Cable/TV, Betting — simulated)
- Apply for and repay loans
- Set / reset a 4-digit transaction PIN
- View receipts and a full transaction history
- Toggle dark mode

## 2. Architecture
- **Frontend**: React 19 + TanStack Start (file-based routes under `src/routes/`), Tailwind v4, shadcn/ui.
- **Backend**: Lovable Cloud (managed Postgres + Auth) with all business logic in PL/pgSQL stored procedures.
- **Client → DB**: the browser calls `supabase.rpc('sp_*', ...)`. Stored procedures enforce auth, PIN, balance, and ownership checks before mutating data.

## 3. Folder layout
```
nextim/
├── database/         ← consolidated SQL reference (schema/procedures/triggers/inserts/queries)
├── docs/             ← ERD, normalization, this report
├── src/
│   ├── routes/       ← pages (TanStack Start file-based routing)
│   ├── components/   ← UI building blocks (banking + shadcn)
│   ├── lib/banking/  ← canonical OOP models + service classes
│   ├── models/       ← per-class re-exports matching the requested layout
│   ├── utils/        ← helpers, validators, security
│   └── integrations/supabase/  ← generated Supabase client (do not edit)
└── supabase/migrations/  ← authoritative, time-stamped DB migrations
```

## 4. Security
- Row Level Security on every public table; every policy scopes to `auth.uid()`.
- 4-digit transaction PIN hashed with bcrypt (`extensions.crypt` + `extensions.gen_salt('bf', 8)`).
- PIN is required for every money movement (deposit, withdrawal, transfer, bill payment, loan application, repayment).
- PIN reset requires re-authenticating with the account password.
- Fraud trigger flags > 3 large transfers (≥ 50 000) within 10 minutes.
- Audit log captures every insert/update/delete on `accounts` and `transactions`.

## 5. OOP design (in `src/lib/banking/models.ts`)
- **Abstraction**: `Account` is abstract.
- **Inheritance**: `SavingsAccount`, `CurrentAccount` extend `Account`.
- **Polymorphism**: each subclass overrides `calculateInterest()`.
- **Encapsulation**: private fields with getters.
- **Custom exceptions**: `BankingError`, `InsufficientFundsError`, `InvalidAccountError`, `AuthError`.

## 6. Deployment
Click **Publish** in the top-right of the Lovable editor to deploy to
`*.lovable.app`. The app is a React SPA — there is no standalone
`index.html` to host elsewhere because the framework needs a Node/Vite
runtime to render server routes and call stored procedures.