'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink, type PlaidLinkOnSuccess } from 'react-plaid-link';
type Account = { id: string; name: string; institution: string; account_type: string };
export function ConnectButton() {
  const [token, setToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  async function loadAccounts() { const response = await fetch('/api/plaid/accounts'); if (!response.ok) return; const data = await response.json(); setAccounts(data.accounts ?? []); }
  useEffect(() => { fetch('/api/plaid/create-link-token', { method: 'POST' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!data.link_token) throw new Error('Plaid did not return a link token.'); setToken(data.link_token); }).catch(error => setMessage(error instanceof Error ? error.message : 'Plaid is not configured.')).finally(() => { setLoading(false); void loadAccounts(); }); }, []);
  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token, metadata) => { setMessage('Finishing connection…'); try { const response = await fetch('/api/plaid/exchange-public-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_token, metadata }) }); const data = await response.json(); setMessage(data.error ?? data.message ?? 'Account connected.'); if (response.ok) await loadAccounts(); } catch { setMessage('The account connection could not be completed.'); } }, []);
  const { open, ready } = usePlaidLink({ token, onSuccess });
  return <div className="text-right"><button onClick={() => open()} disabled={loading || !ready} className="button-quiet">{loading ? 'Loading…' : 'Connect an account'}</button>{accounts.length > 0 && <div className="mt-4 text-left"><p className="label">Connected accounts</p><div className="mt-2 space-y-1">{accounts.map(account => <p key={account.id} className="text-xs text-ink/60">{account.institution} · {account.name}</p>)}</div></div>}{message && <p className="mt-2 max-w-xs text-xs text-ink/55">{message}</p>}</div>;
}
