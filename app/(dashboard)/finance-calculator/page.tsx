import { FinanceCalculatorView } from '@/components/finance-calculator/finance-calculator-view';
import { createClient } from '@/lib/supabase/server';

// Per-user data, read from the session cookie, so never prerendered.
export const dynamic = 'force-dynamic';

// Loads the signed-in user's saved calculator inputs on the server, so the page opens
// with their numbers instead of flashing the defaults first. RLS only returns their row.
async function loadSaved(): Promise<{ userId: string | null; saved: unknown }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { userId: null, saved: null };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { userId: null, saved: null };
    const { data, error } = await supabase.from('calculator_inputs').select('inputs').eq('user_id', user.id).maybeSingle();
    if (error) console.error('Loading calculator inputs failed:', error);
    return { userId: user.id, saved: data?.inputs ?? null };
  } catch (error) {
    console.error(error);
    return { userId: null, saved: null };
  }
}

export default async function Page() {
  const { userId, saved } = await loadSaved();
  return <FinanceCalculatorView userId={userId} saved={saved} />;
}
