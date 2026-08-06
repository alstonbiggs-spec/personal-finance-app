import { createClient } from '@/lib/supabase/client';

type BrowserClient = ReturnType<typeof createClient>;

// Called whenever a user manually assigns a category to a transaction. Saves the
// merchant → category mapping as a rule and immediately applies it to every other
// transaction with the same merchant name, so the same correction doesn't have to
// be made twice. Future syncs also consult these rules (see lib/plaid/sync.ts).
export async function rememberCategoryForMerchant(supabase: BrowserClient, merchantName: string, categoryId: string): Promise<string | null> {
  const { error: ruleError } = await supabase
    .from('rules')
    .upsert({ match_pattern: merchantName, apply_category_id: categoryId }, { onConflict: 'match_pattern' });
  if (ruleError) return ruleError.message;

  // No .neq('category_id', categoryId) guard here: category_id IS NULL rows would
  // fail that comparison (SQL NULL <> x is unknown, not true) and never get updated.
  const { error: propagateError } = await supabase
    .from('transactions')
    .update({ category_id: categoryId, is_manually_edited: true, updated_at: new Date().toISOString() })
    .ilike('name', merchantName)
    .eq('is_manually_edited', false);
  if (propagateError) return propagateError.message;

  return null;
}
