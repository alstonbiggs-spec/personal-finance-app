import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

export function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) throw new Error('Plaid credentials are not configured.');

  if (process.env.PLAID_ENV !== 'production' && process.env.PLAID_ENV !== 'sandbox') {
    throw new Error('PLAID_ENV must be either sandbox or production.');
  }
  const environment = process.env.PLAID_ENV === 'production' ? PlaidEnvironments.production : PlaidEnvironments.sandbox;

  return new PlaidApi(new Configuration({
    basePath: environment,
    baseOptions: { headers: { 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': secret } },
  }));
}
