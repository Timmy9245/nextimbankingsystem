# Database

This folder is the **human-readable reference** for the NexTim database schema.
The authoritative source that actually runs against Lovable Cloud lives in
`supabase/migrations/*.sql` — those files are versioned and applied in order.
These files mirror that schema, split by purpose:

| File              | Contents                                                  |
| ----------------- | --------------------------------------------------------- |
| `schema.sql`      | Tables, sequences, indexes, GRANTs, RLS policies          |
| `procedures.sql`  | Stored procedures / RPC functions (`sp_*`, `verify_pin`)  |
| `triggers.sql`    | Trigger functions and `CREATE TRIGGER` statements         |
| `inserts.sql`     | Sample / seed insert statements                           |
| `queries.sql`     | Common analytical and reporting queries                   |

> Editing files here does NOT change the live database. To change schema,
> add a new migration under `supabase/migrations/` and the platform will
> apply it.