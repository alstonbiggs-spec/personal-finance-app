import Link from 'next/link';
import { CategoryTable } from '@/components/budget/category-table';
import { SpendCharts } from '@/components/charts/spend-charts';
import { SpendPacing } from '@/components/charts/spend-pacing';
import { SpendSankey } from '@/components/charts/spend-sankey';
import { FilterBar } from '@/components/ui/filter-bar';
import { ConnectButton } from '@/components/plaid/connect-button';
import { createClient } from '@/lib/supabase/server';
import { resolvePeriod } from '@/lib/reporting/period';

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const { start, end, label, months } = resolvePeriod(await searchParams);
  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount,category_id,categories(name,parent_category)')
    .eq('is_ignored', false)
    .gte('date', start)
    .lte('date', end);
  type CategoryRef = { name: string; parent_category: string };
  const categoryOf = (row: { categories: CategoryRef | CategoryRef[] | null }) => {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    return category ?? null;
  };
  const parentCategoryOf = (row: { categories: CategoryRef | CategoryRef[] | null }) => categoryOf(row)?.parent_category ?? null;
  // Plaid convention: positive amount = money out (spend), negative amount = money in (deposit).
  // Money moved into savings is never spend, even when it is an outflow (e.g. a contribution
  // to an investment account like Fidelity whose own deposits Plaid does not report).
  const totalSpent = (transactions ?? []).filter((row) => Number(row.amount) > 0 && parentCategoryOf(row) !== 'savings').reduce((sum, row) => sum + Number(row.amount), 0);
  // Total income and total saved are driven by how each deposit was categorized during
  // sync (see lib/plaid/categorize.ts categorizeDeposit) — a credit-card payment credit
  // categorizes to neither, a deposit into a recognized investment/HYSA account
  // categorizes to "savings", and everything else landing in the needs account is "income".
  const totalIncome = (transactions ?? [])
    .filter((row) => Number(row.amount) < 0 && parentCategoryOf(row) === 'income')
    .reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
  // Savings rows come in two shapes: a deposit landing in a savings account (negative, e.g.
  // Ally) or an outflow to a savings vehicle with no deposit feed (positive, e.g. Fidelity).
  // Both are money saved, so count the magnitude of either.
  const totalSaved = (transactions ?? [])
    .filter((row) => parentCategoryOf(row) === 'savings')
    .reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
  const spendByBucket = (bucket: string) => (transactions ?? [])
    .filter((row) => Number(row.amount) > 0 && parentCategoryOf(row) === bucket)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  // Savings uses totalSaved (money moved into savings vehicles) rather than
  // spendByBucket('savings'), since savings transfers post as deposits (negative
  // amount), not spend — mirroring the sankeyBuckets savings figure below. This
  // lets the pie chart show a full needs/wants/savings breakdown of total spend + saved.
  const spendBreakdown = [
    { name: 'Needs', value: spendByBucket('needs') },
    { name: 'Wants', value: spendByBucket('wants') },
    { name: 'Savings', value: totalSaved },
  ];
  // Subcategory breakdown within each bucket (e.g. Needs → Groceries, Rent, Gas / Tolls…)
  // so clicking a bucket slice can drill the second chart into it. Needs/wants are grouped
  // by money spent (positive amount); savings is grouped by money saved (either sign, see
  // totalSaved above) — mirroring the totalSaved vs totalSpent split above.
  const subcategoryAmounts = (bucket: string, mode: 'spent' | 'saved') => {
    const totals = new Map<string, number>();
    for (const row of transactions ?? []) {
      const amount = Number(row.amount);
      if (mode === 'spent' ? amount <= 0 : amount === 0) continue;
      const category = categoryOf(row);
      if (!category || category.parent_category !== bucket) continue;
      totals.set(category.name, (totals.get(category.name) ?? 0) + Math.abs(amount));
    }
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const subcategoryBreakdown = (bucket: string) => subcategoryAmounts(bucket, 'spent');
  const detailByBucket = {
    Needs: subcategoryBreakdown('needs'),
    Wants: subcategoryBreakdown('wants'),
    Savings: subcategoryAmounts('savings', 'saved'),
  };
  // Sankey: same spend/saved figures as above, reshaped into a flow from the household
  // total down through each bucket into its subcategories.
  const sankeyBuckets = [
    { name: 'Needs', value: spendByBucket('needs'), subcategories: subcategoryBreakdown('needs') },
    { name: 'Wants', value: spendByBucket('wants'), subcategories: subcategoryBreakdown('wants') },
    { name: 'Savings', value: totalSaved, subcategories: subcategoryAmounts('savings', 'saved') },
  ];
  const sankeyTotal = sankeyBuckets.reduce((sum, bucket) => sum + bucket.value, 0);

  return <main className="mx-auto flex max-w-7xl flex-col px-6 pb-8 pt-5 sm:block sm:py-10 lg:px-10">
    {/* On phones the header dissolves (display: contents) so the account controls can be
        reordered to the bottom of the page; from sm up it is the original header row. */}
    <div className="contents sm:mb-10 sm:flex sm:items-end sm:justify-between sm:gap-5">
      <div className="hidden sm:block">
        <p className="label mb-3 hidden sm:block">Household overview · {label}</p>
        <h1 className="serif text-4xl sm:text-5xl">Budget</h1>
      </div>
      <div className="order-last mt-12 flex items-start justify-between gap-6 border-t hairline pt-6 sm:order-none sm:mt-0 sm:block sm:border-0 sm:pt-0">
        <h2 className="serif text-xl sm:hidden">Accounts</h2>
        <ConnectButton />
      </div>
    </div>

    <section className="grid grid-cols-[1fr_1.3fr_1fr] items-center gap-2 border-b hairline py-5 text-center sm:grid-cols-3 sm:items-end sm:gap-8 sm:py-8"><div><p className="label">Total income</p><p className="serif mt-2 text-lg text-forest sm:text-3xl">${totalIncome.toLocaleString()}</p></div><div><p className="label">Total spent</p><p className="serif mt-2 text-2xl sm:text-5xl">${totalSpent.toLocaleString()}</p></div><div><p className="label">Total saved</p><p className="serif mt-2 text-lg text-forest sm:text-3xl">${totalSaved.toLocaleString()}</p></div></section>

    <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_.8fr] lg:gap-16"><div><div className="mb-6 flex items-end justify-between"><div><p className="label">Plan vs actual</p><h2 className="serif mt-1 text-2xl">{label}</h2></div><span className="text-xs text-ink/50">Spent / budget{months > 1 ? ` (${months} mo)` : ''}</span></div><FilterBar /><CategoryTable /><SpendPacing /></div><SpendCharts top={spendBreakdown} detailByBucket={detailByBucket} total={totalSpent + totalSaved} /></div><section className="mt-10 border-b hairline py-10"><div className="mb-6"><p className="label">Money flow</p><h2 className="serif mt-1 text-2xl">{label}</h2></div><SpendSankey total={sankeyTotal} buckets={sankeyBuckets} /></section><div className="mt-12"><Link className="button-quiet inline-block" href="/budget/transactions">View all transactions →</Link></div></main>;
}
