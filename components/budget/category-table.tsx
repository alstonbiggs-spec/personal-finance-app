'use client';
import { useMemo, useState } from 'react';

type GroupName = 'NEEDS' | 'WANTS' | 'SAVINGS';
type Category = { id: string; name: string; budget: number; group: GroupName; other?: boolean };
type Expense = { id: string; merchant: string; amount: number; categoryId: string };

const needs = [
  ['Rent', 2500], ['Utilities', 100], ['Wifi', 65], ['Phone Bill', 141], ['Groceries', 900],
  ['Eating Out', 200], ['Gas / Tolls', 400], ['Insurance', 200], ['Misc.', 409], ['Subscribtions', 45],
  ['Amazon', 12], ['Netflix', 8], ['Car registration', 15], ['Proton Duo', 10], ['Gym', 190],
  ['massage', 250], ['Chiropractor', 110],
].map(([name, budget], i) => ({ id: `needs-${i}`, name: name as string, budget: budget as number, group: 'NEEDS' as GroupName }));

const initialCategories: Category[] = [
  ...needs,
  { id: 'needs-other', name: 'Other', budget: 0, group: 'NEEDS', other: true },
  { id: 'wants-dining', name: 'Dining', budget: 800, group: 'WANTS' },
  { id: 'wants-travel', name: 'Travel', budget: 800, group: 'WANTS' },
  { id: 'wants-personal', name: 'Personal', budget: 900, group: 'WANTS' },
  { id: 'wants-other', name: 'Other', budget: 0, group: 'WANTS', other: true },
  { id: 'savings-emergency', name: 'Emergency fund', budget: 1000, group: 'SAVINGS' },
  { id: 'savings-investments', name: 'Investments', budget: 1000, group: 'SAVINGS' },
  { id: 'savings-other', name: 'Other', budget: 0, group: 'SAVINGS', other: true },
];

const initialExpenses: Expense[] = [
  { id: 'e1', merchant: 'Rent / Mortgage', amount: 2500, categoryId: 'needs-0' },
  { id: 'e2', merchant: 'Whole Foods', amount: 180, categoryId: 'needs-4' },
  { id: 'e3', merchant: 'Uncategorized market', amount: 125, categoryId: 'needs-other' },
  { id: 'e4', merchant: 'Old insurance charge', amount: 72, categoryId: 'needs-other' },
  { id: 'e5', merchant: 'Local service', amount: 40, categoryId: 'needs-other' },
  { id: 'e6', merchant: 'The Local Table', amount: 96.5, categoryId: 'wants-dining' },
  { id: 'e7', merchant: 'Emergency transfer', amount: 700, categoryId: 'savings-emergency' },
];

const money = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function CategoryTable() {
  const [categories, setCategories] = useState(initialCategories);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [open, setOpen] = useState<GroupName[]>(['NEEDS']);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const spentByCategory = useMemo(() => expenses.reduce<Record<string, number>>((sum, expense) => { sum[expense.categoryId] = (sum[expense.categoryId] ?? 0) + expense.amount; return sum; }, {}), [expenses]);
  const groups = (['NEEDS', 'WANTS', 'SAVINGS'] as GroupName[]).map(name => {
    const rows = categories.filter(category => category.group === name);
    return { name, rows, spent: rows.reduce((sum, row) => sum + (spentByCategory[row.id] ?? 0), 0), budget: rows.reduce((sum, row) => sum + row.budget, 0) };
  });

  const updateCategory = (id: string, patch: Partial<Category>) => setCategories(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  const addCategory = (group: GroupName) => { const id = `${group.toLowerCase()}-${Date.now()}`; setCategories(rows => [...rows.filter(row => !(row.group === group && row.other)), { id, name: 'New category', budget: 0, group }, ...rows.filter(row => row.group === group && row.other)]); setEditing(id); };
  const deleteCategory = (category: Category) => { if (category.other) return; setCategories(rows => rows.filter(row => row.id !== category.id)); setExpenses(rows => rows.map(expense => expense.categoryId === category.id ? { ...expense, categoryId: `${category.group.toLowerCase()}-other` } : expense)); };
  const reassign = (expenseId: string, categoryId: string) => setExpenses(rows => rows.map(expense => expense.id === expenseId ? { ...expense, categoryId } : expense));
  const toggleGroup = (name: GroupName) => setOpen(value => value.includes(name) ? value.filter(item => item !== name) : [...value, name]);

  return <div className="overflow-hidden border-t hairline">
    {groups.map(group => <div key={group.name}>
      <button onClick={() => toggleGroup(group.name)} className="flex w-full items-center justify-between border-b hairline py-5 text-left">
        <span className="flex items-center gap-3 text-xs font-bold tracking-[.18em]"><span className="text-gold">{open.includes(group.name) ? '−' : '+'}</span>{group.name}</span>
        <span className="text-sm">{money(group.spent)} <span className="text-ink/35">/ {money(group.budget)}</span></span>
      </button>
      {open.includes(group.name) && <div className="border-b hairline">
        {group.rows.map(category => { const categorySpent = spentByCategory[category.id] ?? 0; const isEditing = editing === category.id; const categoryExpenses = expenses.filter(expense => expense.categoryId === category.id); return <div key={category.id}>
          <div className="grid grid-cols-[1fr_auto] gap-4 py-3 pl-8 text-left text-sm hover:bg-white/50">
            <button onClick={() => setExpanded(expanded === category.id ? null : category.id)} className="text-left"><span className="text-gold">{expanded === category.id ? '−' : '+'}</span>&nbsp; {category.name}</button>
            <div className="flex items-center gap-3"><span>{money(categorySpent)} <span className="text-ink/35">/</span> {isEditing ? <input aria-label={`${category.name} budget`} type="number" value={category.budget} onChange={e => updateCategory(category.id, { budget: Number(e.target.value) })} className="w-20 border-b hairline bg-transparent text-right" /> : money(category.budget)}</span><button onClick={() => setEditing(isEditing ? null : category.id)} className="text-[10px] uppercase tracking-wider text-ink/40">{isEditing ? 'Done' : 'Edit'}</button>{!category.other && <button onClick={() => deleteCategory(category)} className="text-[10px] uppercase tracking-wider text-red-700/60">Delete</button>}</div>
          </div>
          {isEditing && <div className="flex gap-2 pb-3 pl-12"><input aria-label={`${category.name} name`} value={category.name} onChange={e => updateCategory(category.id, { name: e.target.value })} className="border-b hairline bg-transparent text-xs" /><span className="text-xs text-ink/40">Budget is editable above</span></div>}
          {expanded === category.id && <div className="mb-3 ml-12 border-l border-gold/40 pl-4 text-xs text-ink/60"><div className="grid grid-cols-[1fr_90px_140px] border-b hairline py-2 uppercase tracking-wider"><span>Expense</span><span>Amount</span><span>Assign category</span></div>{categoryExpenses.length === 0 ? <p className="py-3">No expenses in this category.</p> : categoryExpenses.map(expense => <div key={expense.id} className="grid grid-cols-[1fr_90px_140px] items-center border-b hairline py-3"><span>{expense.merchant}</span><span>{money(expense.amount)}</span><select value={expense.categoryId} onChange={e => reassign(expense.id, e.target.value)} className="bg-transparent text-xs"><option value={category.id}>{category.name}</option>{categories.filter(row => row.group === group.name && row.id !== category.id).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>)}</div>}
        </div> })}
        <button onClick={() => addCategory(group.name)} className="mb-4 ml-12 text-[10px] uppercase tracking-[.16em] text-gold">+ Add category</button>
      </div>}
    </div>)}
    <p className="mt-4 text-xs text-ink/45">Other is calculated automatically from expenses that have not been assigned to a named category. Reassigning an expense moves the same amount between rows while the main category total stays unchanged.</p>
  </div>;
}
