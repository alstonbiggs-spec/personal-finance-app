'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type LinkedAccount = { id: string; name: string; institution: string; bucket: string; current_balance: number | null };
export type ManualItem = { id: string; name: string; category: string; value: number; is_liability: boolean };

const CATEGORIES = ['Savings', 'Investments', 'Retirement', 'Real estate', 'Vehicle', 'Loan', 'Other'];
const ITEM_COLUMNS = 'id,name,category,value,is_liability';
const emptyForm = { name: '', value: '', category: 'Other', is_liability: false };
const money = (value: number | null) => value === null ? '—' : `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (item: ManualItem) => item.is_liability ? -Number(item.value) : Number(item.value);

type Row = { key: string; title: string; subtitle: string; amount: number | null; manual?: ManualItem };

export function NetWorthView({ accounts, workingCapital = [], initialItems, loadError }: { accounts: LinkedAccount[]; workingCapital?: LinkedAccount[]; initialItems: ManualItem[]; loadError?: string }) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(loadError ?? '');

  const balanceSum = (list: LinkedAccount[]) => list.reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0);
  const workingCapitalTotal = balanceSum(workingCapital);
  const total = balanceSum(accounts) + workingCapitalTotal + items.reduce((sum, item) => sum + signed(item), 0);
  const workingRows = workingCapital
    .map(account => ({ key: account.id, title: `${account.institution} · ${account.name}`, subtitle: account.bucket, amount: account.current_balance === null ? null : Number(account.current_balance) }))
    .sort((a, b) => a.title.localeCompare(b.title));
  // Linked and manual rows share one alphabetical list so they read as one set of holdings.
  const rows: Row[] = [
    ...accounts.map(account => ({ key: account.id, title: `${account.institution} · ${account.name}`, subtitle: account.bucket, amount: account.current_balance === null ? null : Number(account.current_balance) })),
    ...items.map(item => ({ key: item.id, title: item.name, subtitle: item.is_liability ? `${item.category} · debt` : item.category, amount: signed(item), manual: item })),
  ].sort((a, b) => a.title.localeCompare(b.title));

  const reset = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };
  const edit = (item: ManualItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, value: String(item.value), category: item.category, is_liability: item.is_liability });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { name: form.name.trim(), value: Math.abs(Number(form.value)), category: form.category, is_liability: form.is_liability, updated_at: new Date().toISOString() };
    const result = editingId
      ? await supabase.from('net_worth_items').update(payload).eq('id', editingId).select(ITEM_COLUMNS).single()
      : await supabase.from('net_worth_items').insert(payload).select(ITEM_COLUMNS).single();
    if (result.error || !result.data) { setStatus(result.error?.message ?? 'Could not save item'); return; }
    const saved = { ...result.data, value: Number(result.data.value) } as ManualItem;
    setItems(current => editingId ? current.map(item => item.id === editingId ? saved : item) : [...current, saved]);
    setStatus('');
    reset();
  }

  async function remove() {
    if (!editingId || !window.confirm('Delete this item?')) return;
    const { error } = await supabase.from('net_worth_items').delete().eq('id', editingId);
    if (error) { setStatus(error.message); return; }
    setItems(current => current.filter(item => item.id !== editingId));
    reset();
  }

  const input = 'mt-2 w-full border-b hairline bg-transparent py-2 text-base outline-none focus:border-forest sm:text-sm';
  return <main className="mx-auto max-w-4xl px-6 py-8 sm:py-10 lg:px-10">
    <div className="mb-8 flex items-end justify-between gap-5 sm:mb-10">
      <div><p className="label mb-3">Household office · Net worth</p><h1 className="serif text-4xl sm:text-5xl">Net Worth</h1></div>
      <button aria-label="Add item" onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest text-2xl font-light text-white transition hover:bg-ink">+</button>
    </div>
    {status && <p className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{status}</p>}
    {showForm && <form onSubmit={submit} className="mb-8 border-y hairline py-8">
      <div className="mb-6 flex items-center justify-between"><div><p className="label">{editingId ? 'Edit item' : 'New item'}</p><h2 className="serif mt-1 text-2xl">{editingId ? 'Update the value' : 'Add something Plaid can’t see'}</h2></div><button type="button" onClick={reset} className="text-xs uppercase tracking-wider text-ink/45">Cancel</button></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block"><span className="label">What</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="House" className={input} /></label>
        <label className="block"><span className="label">Value</span><input required min="0" step="0.01" type="number" inputMode="decimal" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="350000" className={input} /></label>
        <label className="block"><span className="label">Category</span><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={input}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
        <label className="block"><span className="label">Type</span><select value={form.is_liability ? 'debt' : 'asset'} onChange={e => setForm({ ...form, is_liability: e.target.value === 'debt' })} className={input}><option value="asset">Asset (adds to net worth)</option><option value="debt">Debt (subtracts from net worth)</option></select></label>
      </div>
      <div className="mt-7 flex items-center gap-6">
        <button className="button-primary">{editingId ? 'Save changes' : 'Add item'}</button>
        {editingId && <button type="button" onClick={remove} className="text-xs uppercase tracking-wider text-red-700/70 hover:text-red-700">Delete</button>}
      </div>
    </form>}
    <section className="border-b hairline pb-8"><p className="label">Total</p><p className="serif mt-2 text-4xl text-forest">{money(total)}</p></section>
    {rows.length === 0 && workingRows.length === 0 ? <div className="border-t hairline py-16 text-center text-sm text-ink/50">No accounts to show yet. Use the plus sign to add one manually.</div> : <div className="mt-2 divide-y hairline border-t hairline">
      {rows.map(row => {
        const content = <>
          <div className="min-w-0">
            <p className="text-sm">{row.title}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-ink/40">
              {row.subtitle}
              {/* The one marker distinguishing Plaid-linked accounts from hand-entered items. */}
              {!row.manual && <span className="ml-2 rounded-sm border border-gold/50 px-1.5 py-px text-[9px] tracking-[.14em] text-gold">Linked</span>}
            </p>
          </div>
          <p className="serif shrink-0 text-xl">{money(row.amount)}</p>
        </>;
        return row.manual
          ? <button key={row.key} onClick={() => edit(row.manual!)} className="flex w-full items-center justify-between gap-4 py-5 text-left">{content}</button>
          : <div key={row.key} className="flex items-center justify-between gap-4 py-5">{content}</div>;
      })}
    </div>}
    {workingRows.length > 0 && <section className="mt-10 border-t-2 border-ink/70 pt-6">
      <div className="flex items-end justify-between gap-4">
        <div><p className="label">Everyday accounts</p><h2 className="serif mt-1 text-2xl">Working Capital</h2></div>
        <p className="serif shrink-0 text-xl text-forest">{money(workingCapitalTotal)}</p>
      </div>
      <div className="mt-4 divide-y hairline border-t hairline">
        {workingRows.map(row => <div key={row.key} className="flex items-center justify-between gap-4 py-5">
          <div className="min-w-0">
            <p className="text-sm">{row.title}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-ink/40">
              {row.subtitle}
              <span className="ml-2 rounded-sm border border-gold/50 px-1.5 py-px text-[9px] tracking-[.14em] text-gold">Linked</span>
            </p>
          </div>
          <p className="serif shrink-0 text-xl">{money(row.amount)}</p>
        </div>)}
      </div>
    </section>}
    {items.length > 0 && <p className="mt-6 text-xs text-ink/40">Tap a manual item to update its value or delete it.</p>}
  </main>;
}
