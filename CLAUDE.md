# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Household Office": a private two-person household finance dashboard. Next.js App Router + TypeScript + Tailwind 3, Supabase (Postgres + Auth), Plaid Transactions, Recharts. Installable as a PWA (`app/manifest.ts`, generated icons in `app/icon*.tsx` / `app/apple-icon.tsx`).

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — **type-check only** (`tsc --noEmit`); there is no ESLint config
- There is no test framework or test suite. Verify changes with `npm run lint` and `npm run build`, and by exercising the page in the running app.
- Database: apply migrations with `supabase db push` (or paste into the Supabase SQL editor). New schema changes go in a new timestamped file in `supabase/migrations/`; never edit an already-applied migration.

Dependencies use caret ranges (no `latest`). Bump a major version deliberately, not as a side effect.

Setup (from README): copy `.env.example` → `.env.local` (Supabase URL/anon key/service-role key, Plaid client id/secret, `PLAID_ENV` = `sandbox` | `production`, `PLAID_WEBHOOK_URL`). The two household users are created manually in Supabase Auth with matching rows in `profiles`.

## Architecture

### Auth and data access
- `middleware.ts` gates every route: unauthenticated → `/login`; users with MFA enrolled but not at `aal2` → `/login?mfa=required`. If the Supabase env vars are missing it lets everything through in dev ("demo mode") but returns 503 in production.
- Three Supabase clients in `lib/supabase/`:
  - `server.ts`: server components and route handlers (cookie session, RLS applies)
  - `client.ts`: `'use client'` components (browser session, RLS applies)
  - `admin.ts`: service-role client. It bypasses RLS and is the **only** way to touch `plaid_items`, which has no authenticated-user policy and holds Plaid access tokens. Use it only on the server (in `lib/plaid/*` and `app/api/plaid/*`).
- RLS is "any authenticated user can do anything" on every table except `plaid_items`. The app is shared by the whole household, so there is no per-user data scoping.
- Most interactive views read and write Supabase **directly from client components** (e.g. `components/budget/category-table.tsx`, `app/(dashboard)/budget/transactions/page.tsx`). There are no API routes for CRUD. Server components (e.g. `budget/page.tsx`) do the read-only aggregation.

### Plaid sync pipeline (`lib/plaid/`)
- Linking: `create-link-token` → Plaid Link (`components/plaid/connect-button.tsx`) → `exchange-public-token` stores the item and calls `hydratePlaidItemAccounts`. That function infers each account's `owner` and `bucket` from the account name, using hard-coded household-specific rules in `inferOwnerAndBucket`.
- `syncPlaidItem(itemId)` in `sync.ts` is the core. It pages through `/transactions/sync` using the stored cursor, upserts on `plaid_transaction_id`, deletes removed transactions, updates balances, records `last_sync_error` and `needs_reauth`, and then runs `recategorizeUntouchedTransactions`. It runs from the verified webhook (`app/api/plaid/webhook`, ES256 JWT check) and from the manual `POST /api/plaid/sync`.
- **Manual edits are sacred.** Plaid "added" rows get auto-computed `category_id` and `is_ignored`. Plaid "modified" rows never get their category or ignore flag overwritten, and rows with `is_manually_edited = true` also keep their `name`, `amount` and `date`. Any code that writes transactions must preserve this. User edits set `is_manually_edited: true` and `updated_at`.
- Edit tracking: when a user edits `amount` or `date` for the first time, the Plaid value is saved to `original_amount` / `original_date`. These are never overwritten afterwards (see `category-table.tsx`).

### Categorization model
- **Amount sign follows Plaid's convention: positive = money out (spend), negative = money in (deposit).** Amounts are Postgres `numeric`, which PostgREST can return as strings, so wrap them in `Number(...)` before doing arithmetic.
- `categories.parent_category` ∈ `needs | wants | savings | income`. Accounts have a `bucket` ∈ `needs | wants | joint | savings` and an `owner` ∈ `alston | wife | joint`. A transaction's parent category comes from its account's bucket (`parentCategoryForBucket`). Subcategories are matched **by name** (e.g. `Groceries`, `Other`, and `Subscribtions`, which is spelled that way on purpose because it must match the DB row), so renaming a category row breaks auto-categorization.
- All auto-categorization goes through `classifyTransaction` in `sync.ts`, which is used both for new rows and for the per-sync backfill. For an outflow the order is: a learned `rules` row (substring match on merchant and description), then keyword regexes in `categorize.ts`, then the bucket's `Other`. For wants-bucket accounts the subcategory is the spouse (`Alston` / `Wife`), not the merchant. Deposits only use income/savings rules.
- Transfers and card payments are set to `is_ignored` so they aren't double-counted. The exceptions are savings:
  - A deposit into a savings account whose transactions come through Plaid (Ally, `account_type = 'checking'`) is the savings event, and the outgoing leg is ignored.
  - Plaid Transactions returns **nothing for investment accounts** (Fidelity, Vanguard, stored as `account_type = 'debit'`). For these, the outflow from checking is the savings event, even though the brokerage is connected.
  - Savings rows can therefore be negative (a deposit) or positive (an outflow). Reports count the magnitude of both and exclude savings from "spent".
  - Savings categories have household-chosen names, so `resolveSavingsCategoryId` matches an institution name (e.g. "INVESTMENTS (Fidelity)"), then falls back to `Other`, then to the first savings category.
- Read the comments in `categorize.ts` and `sync.ts` before changing any of this.
- `lib/rules/remember-category.ts`: when a user recategorizes a transaction, the change is saved as a rule and applied to every non-edited transaction with the same merchant.
- Reporting periods come from `lib/reporting/period.ts`, set via `?period=` (presets, or `custom` with `&from=YYYY-MM&to=YYYY-MM`). `resolvePeriod` returns `months`, the number of calendar months the period touches. `categories.monthly_budget` is per month and gets multiplied by `months` for display. Reports exclude rows where `is_ignored = true`.

### UI conventions
- Routes live under `app/(dashboard)/` (budget, budget/transactions, net-worth, future-expenses, ontology, profile) and share a layout with `Navigation` and `InactivityLogout`.
- Custom Tailwind tokens and classes (`ink`, `gold`, `forest`, `hairline`, `serif`, `label`, `button-quiet`) are defined in `tailwind.config.ts` and `app/globals.css`. Pages are responsive: tables on `sm+`, stacked cards on mobile, so a UI change usually has to be made in both markups.
