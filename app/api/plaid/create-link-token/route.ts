import { NextResponse } from 'next/server';
import { CountryCode, Products } from 'plaid';
import { createClient } from '@/lib/supabase/server';
import { getPlaidClient } from '@/lib/plaid/client';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'You must be signed in to connect an account.' }, { status: 401 });
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) return NextResponse.json({ error: 'Plaid environment variables are not configured.' }, { status: 500 });

    if (process.env.PLAID_ENV === 'production' && !process.env.PLAID_WEBHOOK_URL) return NextResponse.json({ error: 'PLAID_WEBHOOK_URL is required in production.' }, { status: 500 });
    const response = await getPlaidClient().linkTokenCreate({ user: { client_user_id: user.id }, client_name: 'Household Office', products: [Products.Transactions], country_codes: [CountryCode.Us], language: 'en', ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {}) });
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid link-token creation failed', error);
    return NextResponse.json({ error: 'Plaid could not start. Check the Plaid environment and credentials.' }, { status: 502 });
  }
}
