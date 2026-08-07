import Link from 'next/link';
import { CategoryTable } from '@/components/budget/category-table';
import { SpendCharts } from '@/components/charts/spend-charts';
import { FilterBar } from '@/components/ui/filter-bar';
import { ConnectButton } from '@/components/plaid/connect-button';
import { createClient } from '@/lib/supabase/server';
import { resolvePeriod } from '@/lib/reporting/period';

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const { start, end, label } = resolvePeriod(period);
  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount,category_id,categories(parent_category)')
    .eq('is_ignored', false)
    .gte('date', start)
    .lte('date', end);
  const parentCategoryOf = (row: { categories: { parent_category: string } | { parent_category: string }[] | null }) => {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    return category?.parent_category ?? null;
  };
  // Plaid convention: positive amount = money out (spend), negative amount = money in (deposit).
  const totalSpent = (transactions ?? []).filter((row) => Number(row.amount) > 0).reduce((sum, row) => sum + Number(row.amount), 0);
  // Total income and total saved are driven by how each deposit was categorized during
  // sync (see lib/plaid/categorize.ts categorizeDeposit) — a credit-card payment credit
  // categorizes to neither, a deposit into a recognized investment/HYSA account
  // categorizes to "savings", and everything else landing in the needs account is "income".
  const totalIncome = (transactions ?? [])
    .filter((row) => Number(row.amount) < 0 && parentCategoryOf(row) === 'income')
    .reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
  const totalSaved = (transactions ?? [])
    .filter((row) => Number(row.amount) < 0 && parentCategoryOf(row) === 'savings')
    .reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
  const savingsRate = totalIncome > 0 ? Math.round((totalSaved / totalIncome) * 100) : null;
  const spendByBucket = (bucket: string) => (transactions ?? [])
    .filter((row) => Number(row.amount) > 0 && parentCategoryOf(row) === bucket)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const spendBreakdown = [
    { name: 'Needs', value: spendByBucket('needs') },
    { name: 'Wants', value: spendByBucket('wants') },
    { name: 'Savings', value: spendByBucket('savings') },
  ];
  const chartPoint = [{ name: 'Connected accounts', value: totalSpent }].filter((point) => point.value > 0);

  return <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10"><div className="mb-10 flex items-end justify-between"><div><p className="label mb-3">Household overview · {label}</p><h1 className="serif text-5xl">Budget</h1></div><ConnectButton /></div><FilterBar /><section className="grid grid-cols-2 gap-8 border-b hairline py-8 md:grid-cols-4"><div><p className="label">Total income</p><p className="serif mt-2 text-3xl text-forest">${totalIncome.toLocaleString()}</p></div><div><p className="label">Total spent</p><p className="serif mt-2 text-3xl">${totalSpent.toLocaleString()}</p></div><div><p className="label">Total saved</p><p className="serif mt-2 text-3xl text-forest">${totalSaved.toLocaleString()}</p></div><div><p className="label">Savings rate</p><p className="serif mt-2 text-3xl text-gold">{savingsRate === null ? '—' : `${savingsRate}%`}</p></div></section><div className="mt-10 grid gap-16 lg:grid-cols-[1.2fr_.8fr]"><div><div className="mb-6 flex items-end justify-between"><div><p className="label">Plan vs actual</p><h2 className="serif mt-1 text-2xl">{label}</h2></div><span className="text-xs text-ink/50">Spent / budget</span></div><CategoryTable /></div><SpendCharts top={spendBreakdown} detail={chartPoint} total={totalSpent} /></div><div className="mt-12"><Link className="button-quiet inline-block" href="/budget/transactions">View all transactions →</Link></div></main>;
}
