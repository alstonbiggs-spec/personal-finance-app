import { NextResponse } from 'next/server';
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from 'plaid';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in to connect an account.' }, { status: 401 });
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) return NextResponse.json({ error: 'Plaid environment variables are not configured.' }, { status: 500 });

  const environment = process.env.PLAID_ENV === 'production' ? PlaidEnvironments.production : process.env.PLAID_ENV === 'development' ? PlaidEnvironments.development : PlaidEnvironments.sandbox;
  const config = new Configuration({ basePath: environment, baseOptions: { headers: { 'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID, 'PLAID-SECRET': process.env.PLAID_SECRET } } });
  const plaid = new PlaidApi(config);
  const response = await plaid.linkTokenCreate({ user: { client_user_id: user.id }, client_name: 'Household Office', products: [Products.Transactions], country_codes: [CountryCode.Us], language: 'en' });
  return NextResponse.json({ link_token: response.data.link_token });
}
