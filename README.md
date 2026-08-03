# Household Office

Private household finance dashboard built with Next.js App Router, TypeScript, Tailwind, Supabase, Plaid Transactions, and Recharts.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the Supabase and Plaid values.
2. Run the SQL in `supabase/migrations/20260801000000_household_schema.sql` using Supabase CLI (`supabase db push`) or the Supabase SQL editor.
3. Create the two email/password users manually in Supabase Auth, then add matching rows to `profiles`.
4. Run `npm install` and `npm run dev`.

For production, set `PLAID_ENV=production`, use production Plaid credentials, and set `PLAID_WEBHOOK_URL` to the deployed `/api/plaid/webhook` endpoint. Linked Items are initialized with `/transactions/sync`; subsequent transaction updates are received through Plaid webhooks and persisted in Supabase.
