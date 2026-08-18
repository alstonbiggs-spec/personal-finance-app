'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { resolvePeriod } from '@/lib/reporting/period';
import { rememberCategoryForMerchant } from '@/lib/rules/remember-category';

type GroupName = 'NEEDS' | 'WANTS' | 'SAVINGS' | 'INCOME';
type Category = { id: string; name: string; monthly_budget: number; parent_category: string; sort_order: number };
type ExpenseAccount = { name: string; institution: string };
type Expense = { id: string; name: string; amount: number; date: string; original_amount: number | null; original_date: string | null; category_id: string | null; accounts: ExpenseAccount | ExpenseAccount[] | null };
type SortKey = 'date' | 'amount';
const groups: GroupName[] = ['NEEDS', 'WANTS', 'SAVINGS', 'INCOME'];
const dbGroup = (group: GroupName) => group.toLowerCase();
const money = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const expenseAccountLabel = (expense: Expense) => { const account = Array.isArray(expense.accounts) ? expense.accounts[0] : expense.accounts; return account ? `${account.institution} · ${account.name}` : 'Unknown card'; };
const formatExpenseDate = (isoDate: string) => { const [year, month, day] = isoDate.split('-').map(Number); return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
const seedCategories = [['Rent',2500,'needs'],['Utilities',100,'needs'],['Wifi',65,'needs'],['Phone Bill',141,'needs'],['Groceries',900,'needs'],['Eating Out',200,'needs'],['Gas / Tolls',400,'needs'],['Insurance',200,'needs'],['Misc.',409,'needs'],['Subscribtions',45,'needs'],['Amazon',12,'needs'],['Netflix',8,'needs'],['Car registration',15,'needs'],['Proton Duo',10,'needs'],['Gym',190,'needs'],['massage',250,'needs'],['Chiropractor',110,'needs'],['Other',0,'needs'],['Dining',800,'wants'],['Travel',800,'wants'],['Personal',900,'wants'],['Other',0,'wants'],['Emergency fund',1000,'savings'],['Investments',1000,'savings'],['Other',0,'savings'],['Paycheck',0,'income'],['Other',0,'income']];

export function CategoryTable() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { start, end } = resolvePeriod(searchParams.get('period'));
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [open, setOpen] = useState<GroupName[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingExpenseName, setEditingExpenseName] = useState('');
  const [editingExpenseAmountId, setEditingExpenseAmountId] = useState<string | null>(null);
  const [editingExpenseAmountValue, setEditingExpenseAmountValue] = useState('');
  const [editingExpenseDateId, setEditingExpenseDateId] = useState<string | null>(null);
  const [editingExpenseDateValue, setEditingExpenseDateValue] = useState('');
  const [expenseSort, setExpenseSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  async function loadData() {
    setLoading(true);
    const [{ data: categoryRows }, { data: expenseRows }] = await Promise.all([
      supabase.from('categories').select('id,name,monthly_budget,parent_category,sort_order').order('sort_order').order('created_at'),
      supabase.from('transactions').select('id,name,amount,date,original_amount,original_date,category_id,accounts(name,institution)').eq('is_ignored', false).gte('date', start).lte('date', end).order('date', { ascending: false }),
    ]);
    if (!categoryRows || categoryRows.length === 0) {
      const { data: seeded } = await supabase.from('categories').insert(seedCategories.map(([name, budget, parent_category], index) => ({ name, monthly_budget: budget, parent_category, sort_order: index }))).select('id,name,monthly_budget,parent_category,sort_order');
      setCategories((seeded ?? []) as Category[]);
      setExpenses((expenseRows ?? []) as Expense[]);
    } else {
      setCategories(categoryRows as Category[]);
      setExpenses((expenseRows ?? []) as Expense[]);
    }
    setLoading(false);
  }

  useEffect(() => { loadData().catch(() => { setStatus('Could not load Supabase data. Check that the migration and login are complete.'); setLoading(false); }); }, [start, end]);
  // Deposits (income, savings contributions) are stored as negative amounts per Plaid's
  // convention — take the absolute value so every group's total reads as a positive figure.
  const spentByCategory = useMemo(() => expenses.reduce<Record<string, number>>((sum, expense) => { sum[expense.category_id ?? 'unassigned'] = (sum[expense.category_id ?? 'unassigned'] ?? 0) + Math.abs(Number(expense.amount)); return sum; }, {}), [expenses]);
  const updateCategory = async (category: Category, patch: Partial<Category>) => { setCategories(rows => rows.map(row => row.id === category.id ? { ...row, ...patch } : row)); const { error } = await supabase.from('categories').update({ name: patch.name ?? category.name, monthly_budget: patch.monthly_budget ?? category.monthly_budget }).eq('id', category.id); if (error) setStatus(error.message); };
  const addCategory = async (group: GroupName) => { const nextOrder = categories.filter(row => row.parent_category === dbGroup(group)).length; const { data, error } = await supabase.from('categories').insert({ name: 'New category', monthly_budget: 0, parent_category: dbGroup(group), sort_order: nextOrder }).select('id,name,monthly_budget,parent_category,sort_order').single(); if (error || !data) { setStatus(error?.message ?? 'Could not add category'); return; } setCategories(rows => [...rows.filter(row => !(row.parent_category === dbGroup(group) && row.name === 'Other')), data as Category, ...rows.filter(row => row.parent_category === dbGroup(group) && row.name === 'Other')]); setEditing(data.id); };
  const deleteCategory = async (category: Category) => { if (category.name === 'Other') return; const other = categories.find(row => row.parent_category === category.parent_category && row.name === 'Other'); if (other) await supabase.from('transactions').update({ category_id: other.id }).eq('category_id', category.id); const { error } = await supabase.from('categories').delete().eq('id', category.id); if (error) { setStatus(error.message); return; } setCategories(rows => rows.filter(row => row.id !== category.id)); setExpenses(rows => rows.map(row => row.category_id === category.id ? { ...row, category_id: other?.id ?? null } : row)); };
  const reassign = async (expense: Expense, category_id: string) => {
    setExpenses(rows => rows.map(row => row.id === expense.id ? { ...row, category_id } : row));
    const { error } = await supabase.from('transactions').update({ category_id, is_manually_edited: true, updated_at: new Date().toISOString() }).eq('id', expense.id);
    if (error) { setStatus(error.message); return; }
    // Remember this merchant → category choice and apply it to every other
    // transaction with the same name, so it doesn't have to be corrected twice.
    const ruleError = await rememberCategoryForMerchant(supabase, expense.name, category_id);
    if (ruleError) setStatus(ruleError);
    else await loadData();
    // The household summary bar (income/spent/saved/rate) is server-rendered on the
    // page and won't otherwise pick up this change until a full navigation.
    router.refresh();
  };
  const ignoreExpense = async (expense: Expense) => { setExpenses(rows => rows.filter(row => row.id !== expense.id)); const { error } = await supabase.from('transactions').update({ is_ignored: true, updated_at: new Date().toISOString() }).eq('id', expense.id); if (error) { setStatus(error.message); return; } router.refresh(); };
  const startEditingExpense = (expense: Expense) => { setEditingExpenseId(expense.id); setEditingExpenseName(expense.name); };
  const commitExpenseName = async (expense: Expense) => {
    const name = editingExpenseName.trim();
    setEditingExpenseId(null);
    if (!name || name === expense.name) return;
    setExpenses(rows => rows.map(row => row.id === expense.id ? { ...row, name } : row));
    const { error } = await supabase.from('transactions').update({ name, is_manually_edited: true, updated_at: new Date().toISOString() }).eq('id', expense.id);
    if (error) setStatus(error.message);
  };
  const startEditingExpenseAmount = (expense: Expense) => { setEditingExpenseAmountId(expense.id); setEditingExpenseAmountValue(Math.abs(Number(expense.amount)).toFixed(2)); };
  const commitExpenseAmount = async (expense: Expense) => {
    const parsed = Number(editingExpenseAmountValue);
    setEditingExpenseAmountId(null);
    if (!editingExpenseAmountValue || Number.isNaN(parsed) || parsed < 0) return;
    // Preserve the existing sign (spend vs. deposit) — the input only edits the magnitude.
    const amount = (Number(expense.amount) < 0 ? -1 : 1) * parsed;
    if (amount === Number(expense.amount)) return;
    const original_amount = expense.original_amount ?? expense.amount;
    setExpenses(rows => rows.map(row => row.id === expense.id ? { ...row, amount, original_amount } : row));
    const { error } = await supabase.from('transactions').update({ amount, original_amount, is_manually_edited: true, updated_at: new Date().toISOString() }).eq('id', expense.id);
    if (error) { setStatus(error.message); return; }
    // The household summary bar and category totals are server-rendered and won't
    // otherwise reflect an edited amount until reloaded.
    router.refresh();
  };
  const startEditingExpenseDate = (expense: Expense) => { setEditingExpenseDateId(expense.id); setEditingExpenseDateValue(expense.date); };
  const commitExpenseDate = async (expense: Expense) => {
    const date = editingExpenseDateValue;
    setEditingExpenseDateId(null);
    if (!date || date === expense.date) return;
    const original_date = expense.original_date ?? expense.date;
    setExpenses(rows => rows.map(row => row.id === expense.id ? { ...row, date, original_date } : row));
    const { error } = await supabase.from('transactions').update({ date, original_date, is_manually_edited: true, updated_at: new Date().toISOString() }).eq('id', expense.id);
    if (error) { setStatus(error.message); return; }
    router.refresh();
  };
  const toggleExpenseSort = (key: SortKey) => setExpenseSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  const sortExpenses = (list: Expense[]) => [...list].sort((a, b) => {
    const factor = expenseSort.dir === 'desc' ? -1 : 1;
    if (expenseSort.key === 'amount') return (Math.abs(Number(a.amount)) - Math.abs(Number(b.amount))) * factor;
    return a.date.localeCompare(b.date) * factor;
  });
  const reorder = async (group: GroupName, draggedId: string, targetId: string) => { setDragOverId(null); if (draggedId === targetId) return; const groupRows = categories.filter(row => row.parent_category === dbGroup(group)).sort((a, b) => a.sort_order - b.sort_order); const from = groupRows.findIndex(row => row.id === draggedId); const to = groupRows.findIndex(row => row.id === targetId); if (from < 0 || to < 0) return; const reordered = [...groupRows]; const [moved] = reordered.splice(from, 1); reordered.splice(to, 0, moved); const orderById = new Map(reordered.map((row, index) => [row.id, index])); setCategories(rows => rows.map(row => orderById.has(row.id) ? { ...row, sort_order: orderById.get(row.id)! } : row)); const results = await Promise.all(reordered.map((row, index) => supabase.from('categories').update({ sort_order: index }).eq('id', row.id))); const failed = results.find(result => result.error); if (failed?.error) setStatus(failed.error.message); };
  if (loading) return <div className="border-t hairline py-10 text-sm text-ink/50">Loading your categories…</div>;
  return <div className="overflow-hidden border-t hairline">{status && <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{status}</p>}{groups.map(group => { const rows = categories.filter(category => category.parent_category === dbGroup(group)).sort((a, b) => a.sort_order - b.sort_order); const spent = rows.reduce((sum, row) => sum + (spentByCategory[row.id] ?? 0), 0); const budget = rows.reduce((sum, row) => sum + Number(row.monthly_budget), 0); const accent = group === 'INCOME' ? 'text-forest' : 'text-gold'; return <div key={group}>
    <button onClick={() => setOpen(value => value.includes(group) ? value.filter(item => item !== group) : [...value, group])} className="flex w-full items-center justify-between border-b hairline py-5 text-left"><span className="flex items-center gap-3 text-xs font-bold tracking-[.18em]"><span className={accent}>{open.includes(group) ? '−' : '+'}</span>{group}</span><span className={`text-sm ${group === 'INCOME' ? 'text-forest' : ''}`}>{money(spent)} <span className="text-ink/35">/ {money(budget)}</span></span></button>
    {open.includes(group) && <div className="border-b hairline">{rows.map(category => { const categoryExpenses = expenses.filter(expense => expense.category_id === category.id); const categorySpent = spentByCategory[category.id] ?? 0; const isEditing = editing === category.id; return <div key={category.id} onDragOver={event => { event.preventDefault(); setDragOverId(category.id); }} onDragLeave={() => setDragOverId(current => current === category.id ? null : current)} onDrop={event => { const draggedId = event.dataTransfer.getData('category-id'); if (draggedId) reorder(group, draggedId, category.id); }}><div className={`h-0.5 transition-all ${dragOverId === category.id ? 'mx-4 bg-gold/70 shadow-[0_0_0_3px_rgba(173,138,80,0.12)]' : 'bg-transparent'}`} /><div className="grid grid-cols-[1fr_auto] gap-4 py-3 pl-8 text-left text-sm hover:bg-white/50"><button onClick={() => setExpanded(expanded === category.id ? null : category.id)} className="text-left"><span draggable={!isEditing} onDragStart={event => { event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('category-id', category.id); }} onDragEnd={() => setDragOverId(null)} onClick={event => event.stopPropagation()} className="mr-1 inline-block cursor-grab text-ink/35 active:cursor-grabbing">⋮⋮</span><span className={accent}>{expanded === category.id ? '−' : '+'}</span>&nbsp; {category.name}</button><div className="flex items-center gap-3"><span className={group === 'INCOME' ? 'text-forest' : ''}>{money(categorySpent)}</span> <span className="text-ink/35">/</span> {isEditing ? <input aria-label={`${category.name} budget`} type="number" value={category.monthly_budget} onChange={e => updateCategory(category, { monthly_budget: Number(e.target.value) })} className="w-20 border-b hairline bg-transparent text-right" /> : <span>{money(Number(category.monthly_budget))}</span>}<button onClick={() => setEditing(isEditing ? null : category.id)} className="text-[10px] uppercase tracking-wider text-ink/40">{isEditing ? 'Done' : 'Edit'}</button>{category.name !== 'Other' && <button onClick={() => deleteCategory(category)} className="text-[10px] uppercase tracking-wider text-red-700/60">Delete</button>}</div></div>{isEditing && <div className="flex gap-2 pb-3 pl-12"><input aria-label={`${category.name} name`} value={category.name} onChange={e => updateCategory(category, { name: e.target.value })} className="border-b hairline bg-transparent text-xs" /><span className="text-xs text-ink/40">Changes save automatically</span></div>}{expanded === category.id && <div className="mb-3 ml-12 border-l border-gold/40 pl-4 text-xs text-ink/60"><div className="grid grid-cols-[1fr_90px_110px_150px_60px] items-center border-b hairline py-2 uppercase tracking-wider"><button onClick={() => toggleExpenseSort('date')} className={`text-left hover:text-gold ${expenseSort.key === 'date' ? 'text-gold' : ''}`}>Expense{expenseSort.key === 'date' ? (expenseSort.dir === 'desc' ? ' ↓' : ' ↑') : ''}</button><button onClick={() => toggleExpenseSort('amount')} className={`text-left hover:text-gold ${expenseSort.key === 'amount' ? 'text-gold' : ''}`}>Amount{expenseSort.key === 'amount' ? (expenseSort.dir === 'desc' ? ' ↓' : ' ↑') : ''}</button><button onClick={() => toggleExpenseSort('date')} className={`text-left hover:text-gold ${expenseSort.key === 'date' ? 'text-gold' : ''}`}>Date{expenseSort.key === 'date' ? (expenseSort.dir === 'desc' ? ' ↓' : ' ↑') : ''}</button><span>Assign category</span><span></span></div>{categoryExpenses.length === 0 ? <p className="py-3">No expenses in this category.</p> : sortExpenses(categoryExpenses).map(expense => { const amountEdited = expense.original_amount !== null && expense.original_amount !== undefined && Number(expense.original_amount) !== Number(expense.amount); const dateEdited = expense.original_date !== null && expense.original_date !== undefined && expense.original_date !== expense.date; return <div key={expense.id} className="group border-b hairline py-3"><div className="grid grid-cols-[1fr_90px_110px_150px_60px] items-center">{editingExpenseId === expense.id ? <input aria-label="Expense name" autoFocus value={editingExpenseName} onChange={e => setEditingExpenseName(e.target.value)} onBlur={() => commitExpenseName(expense)} onKeyDown={e => { if (e.key === 'Enter') commitExpenseName(expense); if (e.key === 'Escape') setEditingExpenseId(null); }} className="border-b hairline bg-transparent" /> : <button onClick={() => startEditingExpense(expense)} className="text-left hover:underline">{expense.name}</button>}<span className="flex items-center gap-1.5">{editingExpenseAmountId === expense.id ? <input aria-label="Expense amount" autoFocus type="number" step="0.01" min="0" value={editingExpenseAmountValue} onChange={e => setEditingExpenseAmountValue(e.target.value)} onBlur={() => commitExpenseAmount(expense)} onKeyDown={e => { if (e.key === 'Enter') commitExpenseAmount(expense); if (e.key === 'Escape') setEditingExpenseAmountId(null); }} className="w-16 border-b hairline bg-transparent" /> : <button onClick={() => startEditingExpenseAmount(expense)} className={`hover:underline ${group === 'INCOME' ? 'font-medium text-forest' : ''} ${amountEdited ? 'text-gold' : ''}`}>{money(Math.abs(Number(expense.amount)))}</button>}{amountEdited && editingExpenseAmountId !== expense.id && <span className="group/edit relative inline-block"><span className="block h-1.5 w-1.5 rounded-full bg-gold" /><span className="invisible absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm border hairline bg-white px-2 py-1 text-[10px] text-ink/60 opacity-0 shadow-lg transition duration-150 group-hover/edit:visible group-hover/edit:opacity-100">Originally {money(Math.abs(Number(expense.original_amount)))}</span></span>}</span><span className="flex items-center gap-1.5">{editingExpenseDateId === expense.id ? <input aria-label="Expense date" autoFocus type="date" value={editingExpenseDateValue} onChange={e => setEditingExpenseDateValue(e.target.value)} onBlur={() => commitExpenseDate(expense)} onKeyDown={e => { if (e.key === 'Enter') commitExpenseDate(expense); if (e.key === 'Escape') setEditingExpenseDateId(null); }} className="border-b hairline bg-transparent text-xs" /> : <button onClick={() => startEditingExpenseDate(expense)} className={`text-xs hover:underline ${dateEdited ? 'text-gold' : 'text-ink/60'}`}>{formatExpenseDate(expense.date)}</button>}{dateEdited && editingExpenseDateId !== expense.id && <span className="group/edit relative inline-block"><span className="block h-1.5 w-1.5 rounded-full bg-gold" /><span className="invisible absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm border hairline bg-white px-2 py-1 text-[10px] text-ink/60 opacity-0 shadow-lg transition duration-150 group-hover/edit:visible group-hover/edit:opacity-100">Originally {formatExpenseDate(expense.original_date as string)}</span></span>}</span><select value={expense.category_id ?? ''} onChange={e => reassign(expense, e.target.value)} className="bg-transparent text-xs">{categories.filter(row => row.parent_category === dbGroup(group)).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><button onClick={() => ignoreExpense(expense)} className="text-right text-[10px] uppercase tracking-wider text-ink/40 hover:text-red-700">Ignore</button></div><div className="max-h-0 overflow-hidden text-[10px] text-ink/40 transition-all duration-200 group-hover:max-h-6 group-hover:pt-1">{expenseAccountLabel(expense)}</div></div>; })}</div>}</div>; })}<button onClick={() => addCategory(group)} className={`mb-4 ml-12 text-[10px] uppercase tracking-[.16em] ${accent}`}>+ Add category</button><p className="mb-4 ml-12 text-[10px] text-ink/40">Drag the ⋮⋮ handle to reorder categories. The gold line shows the drop position.</p></div>}
  </div>; })}<p className="mt-4 text-xs text-ink/45">Other is a real Supabase category. Reassigning an expense updates its category_id, so the same amount moves between rows without changing the main category total.</p></div>;
}
