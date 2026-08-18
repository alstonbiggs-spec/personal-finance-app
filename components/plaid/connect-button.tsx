'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaidLink, type PlaidLinkOnSuccess } from 'react-plaid-link';
type Account = { id: string; name: string; institution: string; account_type: string; owner: string; bucket: string; currentBalance: number | null; availableBalance: number | null; lastSyncedAt: string | null; syncError: string | null; needsReauth: boolean };
type SyncResult = { itemId: string; institutionName: string | null; ok: boolean; error?: string };
const money = (value: number | null) => value === null ? '—' : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusColor = (account: Account) => account.needsReauth || account.syncError ? 'bg-red-500' : account.lastSyncedAt ? 'bg-forest' : 'bg-ink/30';
export function ConnectButton() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pinnedAccountId, setPinnedAccountId] = useState<string | null>(null);
  async function loadAccounts() { const response = await fetch('/api/plaid/accounts'); if (!response.ok) return; const data = await response.json(); setAccounts(data.accounts ?? []); }
  useEffect(() => { fetch('/api/plaid/create-link-token', { method: 'POST' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!data.link_token) throw new Error('Plaid did not return a link token.'); setToken(data.link_token); }).catch(error => setMessage(error instanceof Error ? error.message : 'Plaid is not configured.')).finally(() => { setLoading(false); void loadAccounts(); }); }, []);
  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token, metadata) => { setMessage('Finishing connection…'); try { const response = await fetch('/api/plaid/exchange-public-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_token, metadata }) }); const data = await response.json(); setMessage(data.error ?? data.message ?? 'Account connected.'); if (response.ok) { await loadAccounts(); router.refresh(); } } catch { setMessage('The account connection could not be completed.'); } }, [router]);
  async function syncTransactions() {
    setSyncing(true);
    setMessage('Syncing transactions…');
    try {
      const response = await fetch('/api/plaid/sync', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await loadAccounts();
      // The household summary bar (income/spent/saved/rate) is server-rendered on the
      // page and won't otherwise reflect newly-synced transactions until reloaded.
      router.refresh();
      const failures = (data.results as SyncResult[] | undefined)?.filter((result) => !result.ok) ?? [];
      setMessage(failures.length ? `${failures.map((failure) => `${failure.institutionName ?? 'Account'}: ${failure.error}`).join(' · ')}` : 'Transactions synced.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Transaction sync failed.');
    } finally {
      setSyncing(false);
    }
  }
  const { open, ready } = usePlaidLink({ token, onSuccess });
  return <div className="text-right"><button onClick={() => open()} disabled={loading || !ready} className="button-quiet">{loading ? 'Loading…' : 'Connect an account'}</button>{accounts.length > 0 && <div className="mt-4 text-left"><button onClick={() => { setExpanded(!expanded); setPinnedAccountId(null); }} className="label flex items-center gap-1.5"><span>Connected accounts ({accounts.length})</span><svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>{expanded && <div className="mt-2 space-y-1">{accounts.map(account => <div key={account.id} className="group relative" onClick={() => setPinnedAccountId(current => current === account.id ? null : account.id)}><p className="flex items-center gap-2 text-xs text-ink/60"><span className={`h-1.5 w-1.5 rounded-full ${statusColor(account)}`} />{account.institution} · {account.name}</p><div style={pinnedAccountId === account.id ? { visibility: 'visible', opacity: 1 } : undefined} className="invisible absolute right-0 top-full z-20 mt-1 w-64 rounded-sm border hairline bg-white p-4 text-xs opacity-0 shadow-lg transition duration-150 group-hover:visible group-hover:opacity-100 sm:w-72"><p className="serif text-sm">{account.institution} · {account.name}</p><div className="mt-3 space-y-1.5 text-ink/60"><p className="flex justify-between"><span className="text-ink/40">Type</span><span className="capitalize">{account.account_type}</span></p><p className="flex justify-between"><span className="text-ink/40">Owner · Bucket</span><span className="capitalize">{account.owner} · {account.bucket}</span></p><p className="flex justify-between"><span className="text-ink/40">Balance</span><span>{money(account.currentBalance)}</span></p><p className="flex justify-between"><span className="text-ink/40">Available</span><span>{money(account.availableBalance)}</span></p></div><div className="mt-3 border-t hairline pt-2">{account.needsReauth ? <p className="text-red-600">Needs to be reconnected — click &ldquo;Connect an account&rdquo; and relink {account.institution}.</p> : account.syncError ? <p className="text-red-600">{account.syncError}</p> : account.lastSyncedAt ? <p className="text-ink/40">Last synced {new Date(account.lastSyncedAt).toLocaleString()}</p> : <p className="text-ink/40">Not yet synced</p>}</div></div></div>)}</div>}<button onClick={syncTransactions} disabled={syncing} className="mt-3 text-xs uppercase tracking-wider text-gold">{syncing ? 'Syncing…' : 'Sync transactions'}</button></div>}{message && <p className="mt-2 max-w-xs text-xs text-ink/55">{message}</p>}</div>;
}
