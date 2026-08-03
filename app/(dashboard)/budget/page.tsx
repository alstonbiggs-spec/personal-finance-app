import Link from 'next/link';
import { CategoryTable } from '@/components/budget/category-table';
import { SpendCharts } from '@/components/charts/spend-charts';
import { FilterBar } from '@/components/ui/filter-bar';
import { ConnectButton } from '@/components/plaid/connect-button';
import { createClient } from '@/lib/supabase/server';

export default async function BudgetPage() {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  const start = monthStart.toISOString().slice(0, 10);
  const [{ data: transactions }, { data: accounts }] = await Promise.all([
    supabase.from('transactions').select('amount,category_id').eq('is_ignored', false).gte('date', start),
    supabase.from('accounts').select('current_balance,available_balance').not('plaid_item_id', 'is', null),
  ]);
  const totalExpenses = (transactions ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const currentBalance = (accounts ?? []).reduce((sum, row) => sum + Number(row.current_balance ?? 0), 0);
  const availableBalance = (accounts ?? []).reduce((sum, row) => sum + Number(row.available_balance ?? 0), 0);
  const chartPoint = [{ name: 'Connected accounts', value: totalExpenses }].filter((point) => point.value > 0);

  return <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10"><div className="mb-10 flex items-end justify-between"><div><p className="label mb-3">Household overview · {monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p><h1 className="serif text-5xl">Budget</h1></div><ConnectButton /></div><FilterBar /><section className="grid grid-cols-2 gap-8 border-b hairline py-8 md:grid-cols-4"><div><p className="label">Connected balance</p><p className="serif mt-2 text-3xl">${currentBalance.toLocaleString()}</p></div><div><p className="label">Total expenses</p><p className="serif mt-2 text-3xl">${totalExpenses.toLocaleString()}</p></div><div><p className="label">Available</p><p className="serif mt-2 text-3xl text-forest">${availableBalance.toLocaleString()}</p></div><div><p className="label">Savings rate</p><p className="serif mt-2 text-3xl text-gold">—</p></div></section><div className="mt-10 grid gap-16 lg:grid-cols-[1.2fr_.8fr]"><div><div className="mb-6 flex items-end justify-between"><div><p className="label">Plan vs actual</p><h2 className="serif mt-1 text-2xl">This month</h2></div><span className="text-xs text-ink/50">Spent / budget</span></div><CategoryTable /></div><SpendCharts top={chartPoint} detail={chartPoint} total={totalExpenses} /></div><div className="mt-12"><Link className="button-quiet inline-block" href="/budget/transactions">View all transactions →</Link></div></main>;
}
