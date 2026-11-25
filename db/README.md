# Database changes

This folder is where database changes live from now on. It is not the folder the
old SQL files are in: `migrations/` and `scripts/` are untouched history and must
not be moved, edited or re-run from here.

## The rule

Every database change is **one migration file and its matching down file**:

```
db/migrations/0001_add_order_channel.sql
db/migrations/0001_add_order_channel.down.sql
```

- `NNNN` is the next number in sequence, four digits, zero padded.
- `short_name` is snake_case and describes the change, not the ticket.
- The pair must be committed together. A migration without a down file is not
  merged.

## What goes inside

Both files are wrapped in a transaction:

```sql
BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel text;

COMMIT;
```

```sql
BEGIN;

ALTER TABLE orders DROP COLUMN IF EXISTS channel;

COMMIT;
```

## Additive only

While old code is still running against the database, a migration may:

- add a table,
- add a column, with `IF NOT EXISTS`,
- add an index, with `CREATE INDEX CONCURRENTLY` outside a transaction block,
- add or replace a function or a view.

A migration may **not**, in the same release that ships the code that stops using
the object:

- drop a table, a column or an index,
- rename anything,
- narrow a type,
- add a `NOT NULL` to an existing column without a default.

Those happen in a later migration, after the release that stopped using the old
shape is live and has been live long enough that no instance is running it. Two
releases: first stop using it, then remove it.

## The functions are not yours to change

The `fb_*` functions own the money: `fb_settle_payment`, `fb_request_refund`,
`fb_reserve_withdrawal`, `fb_reverse_failed_refund`,
`fb_reverse_failed_withdrawal`, `fb_record_withdrawal_fee`,
`fb_admin_reserve_transfer` and the rest. A migration may add a new function.
A migration that changes how an existing `fb_*` function calculates a balance,
a fee, a settlement or a refund is a separate decision, reviewed on its own, with
the rollback scripts in `tests/sql` run on a Neon branch first.

## Applying a migration

1. Run the up file on a Neon branch.
2. Run the rollback scripts in `tests/sql` against that branch.
3. Run the down file, confirm the schema returns to its previous shape.
4. Run the up file again.
5. Then, and only then, apply to production, in a deploy that also ships the code
   that expects it.

## Naming the next number

```bash
ls db/migrations | sort | tail -2
```

Take the highest number and add one. Do not reuse a number, even if the migration
was reverted: the history is the record.
