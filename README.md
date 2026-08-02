# Household Office

Private household finance dashboard built with Next.js App Router, TypeScript, Tailwind, Supabase, Plaid Sandbox, and Recharts.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the Supabase and Plaid values.
2. Run the SQL in `supabase/migrations/20260801000000_household_schema.sql` using Supabase CLI (`supabase db push`) or the Supabase SQL editor.
3. Create the two email/password users manually in Supabase Auth, then add matching rows to `profiles`.
4. Run `npm install` and `npm run dev`.

The Plaid exchange endpoint currently validates receipt of the public token and returns metadata. Before using it with real household data, persist the exchanged access token in a server-only store (never a client-readable table) and insert the linked account through the service-role client.
