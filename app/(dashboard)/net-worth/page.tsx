import { createClient } from '@/lib/supabase/server';

type Account = { id: string; name: string; institution: string; account_type: string; bucket: string; owner: string; current_balance: number | null };
const money = (value: number | null) => value === null ? '—' : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function NetWorthPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('accounts').select('id,name,institution,account_type,bucket,owner,current_balance').order('institution').order('name');
  // USAA accounts are the household's everyday checking, not something we're tracking
  // net worth against here; credit cards are liabilities on a statement cycle, not assets.
  const accounts = ((data ?? []) as Account[]).filter((account) => account.account_type !== 'credit' && !account.institution.toLowerCase().includes('usaa'));
  const total = accounts.reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0);

  return <main className="mx-auto max-w-4xl px-6 py-8 sm:py-10 lg:px-10">
    <div className="mb-8 sm:mb-10"><p className="label mb-3">Household office · Net worth</p><h1 className="serif text-4xl sm:text-5xl">Net Worth</h1></div>
    <section className="border-b hairline pb-8"><p className="label">Total</p><p className="serif mt-2 text-4xl text-forest">{money(total)}</p></section>
    {accounts.length === 0 ? <div className="border-t hairline py-16 text-center text-sm text-ink/50">No accounts to show yet.</div> : <div className="mt-2 divide-y hairline border-t hairline">{accounts.map(account => <div key={account.id} className="flex items-center justify-between py-5"><div><p className="text-sm">{account.institution} · {account.name}</p><p className="mt-1 text-xs uppercase tracking-wider text-ink/40">{account.bucket}</p></div><p className="serif text-xl">{money(account.current_balance)}</p></div>)}</div>}
  </main>;
}
