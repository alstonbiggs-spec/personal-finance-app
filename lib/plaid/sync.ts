import type { Transaction as PlaidTransaction } from 'plaid';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlaidClient } from '@/lib/plaid/client';
import { categorizeDeposit, isSavingsVehicleInstitution, isTransfer, matchSubcategoryName, parentCategoryForBucket } from '@/lib/plaid/categorize';

type PlaidItem = { id: string; item_id: string; access_token: string; sync_cursor: string | null };
type AccountInfo = { id: string; owner: string; bucket: string; accountType: string; institution: string };
type CategoryLookup = Map<string, string>;
type RuleEntry = { pattern: string; categoryId: string };

const REAUTH_ERROR_CODES = new Set(['ITEM_LOGIN_REQUIRED', 'ITEM_LOCKED', 'ITEM_NOT_SUPPORTED', 'INVALID_ACCESS_TOKEN', 'INVALID_CREDENTIALS']);

function describePlaidError(error: unknown): { code: string | null; message: string } {
  const data = (error as { response?: { data?: { error_code?: string; error_message?: string; display_message?: string } } })?.response?.data;
  if (data?.error_code) {
    return { code: data.error_code, message: data.display_message ?? data.error_message ?? data.error_code };
  }
  if (error instanceof Error) return { code: null, message: error.message };
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    if (typeof record.message === 'string' && record.message) {
      const parts = [record.message, typeof record.details === 'string' ? record.details : null, typeof record.hint === 'string' ? record.hint : null].filter(Boolean);
      return { code: typeof record.code === 'string' ? record.code : null, message: parts.join(' — ') };
    }
    try {
      return { code: null, message: JSON.stringify(error) };
    } catch {
      // fall through
    }
  }
  return { code: null, message: 'Unknown error.' };
}

function categoryKey(parentCategory: string, name: string) {
  return `${parentCategory}::${name}`;
}

async function loadCategoryLookup(admin: ReturnType<typeof createAdminClient>): Promise<CategoryLookup> {
  const { data } = await admin.from('categories').select('id,name,parent_category');
  const lookup: CategoryLookup = new Map();
  for (const category of data ?? []) lookup.set(categoryKey(category.parent_category, category.name), category.id);
  return lookup;
}

function resolveCategoryId(lookup: CategoryLookup, bucket: string, subcategoryName: string | null): string | null {
  const parent = parentCategoryForBucket(bucket);
  if (subcategoryName) {
    const specific = lookup.get(categoryKey(parent, subcategoryName));
    if (specific) return specific;
  }
  return lookup.get(categoryKey(parent, 'Other')) ?? null;
}

function resolveDepositCategoryId(lookup: CategoryLookup, parent: 'income' | 'savings' | null): string | null {
  if (!parent) return null;
  return lookup.get(categoryKey(parent, 'Other')) ?? null;
}

// Learned merchant → category rules (see lib/rules/remember-category.ts), created whenever
// a user manually reassigns a transaction. Checked before the generic keyword matcher.
async function loadRules(admin: ReturnType<typeof createAdminClient>): Promise<RuleEntry[]> {
  const { data } = await admin.from('rules').select('match_pattern,apply_category_id');
  return (data ?? []).map((rule) => ({ pattern: rule.match_pattern.toLowerCase(), categoryId: rule.apply_category_id }));
}

function matchRuleCategoryId(name: string, originalDescription: string, rules: RuleEntry[]): string | null {
  const text = `${name} ${originalDescription}`.toLowerCase();
  for (const rule of rules) {
    if (rule.pattern && text.includes(rule.pattern)) return rule.categoryId;
  }
  return null;
}

export async function syncPlaidItem(itemId: string) {
  const admin = createAdminClient();
  const { data: item, error: itemError } = await admin
    .from('plaid_items')
    .select('id,item_id,access_token,sync_cursor')
    .eq('item_id', itemId)
    .single<PlaidItem>();
  if (itemError || !item) throw itemError ?? new Error('Plaid Item was not found.');

  const { data: linkedAccounts, error: accountsError } = await admin
    .from('accounts')
    .select('id,plaid_account_id,owner,bucket,account_type,institution')
    .eq('plaid_item_id', itemId);
  if (accountsError) throw accountsError;
  const accountsByPlaidId = new Map((linkedAccounts ?? []).map((account) => [account.plaid_account_id, { id: account.id, owner: account.owner, bucket: account.bucket, accountType: account.account_type, institution: account.institution } as AccountInfo]));
  const categoryLookup = await loadCategoryLookup(admin);
  const rules = await loadRules(admin);

  const plaid = getPlaidClient();
  let cursor = item.sync_cursor ?? '';
  let hasMore = true;
  let added = 0;
  let modified = 0;
  let removed = 0;

  try {
    while (hasMore) {
      const response = await plaid.transactionsSync({
        access_token: item.access_token,
        cursor,
        count: 500,
        options: { include_original_description: true },
      });
      const result = response.data;

      if (result.added.length || result.modified.length) {
        // "added" rows are brand new, so it's safe to set an auto-computed category/ignore
        // flag. "modified" rows may already have a user's manual edits on them (Plaid can
        // resend a transaction as it moves from pending to posted) — never touch category_id
        // or is_ignored there, only the fields Plaid actually owns.
        const newRows = result.added
          .map((transaction) => toTransactionRow(transaction, accountsByPlaidId.get(transaction.account_id), categoryLookup, rules, true))
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
        const updatedRows = result.modified
          .map((transaction) => toTransactionRow(transaction, accountsByPlaidId.get(transaction.account_id), categoryLookup, rules, false))
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
        // Kept as two separate requests: PostgREST's bulk upsert requires every row in
        // one request to share the same set of keys, and these two batches don't.
        if (newRows.length) {
          const { error } = await admin.from('transactions').upsert(newRows, { onConflict: 'plaid_transaction_id' });
          if (error) throw error;
        }
        if (updatedRows.length) {
          const { error } = await admin.from('transactions').upsert(updatedRows, { onConflict: 'plaid_transaction_id' });
          if (error) throw error;
        }
        added += result.added.length;
        modified += result.modified.length;
      }

      if (result.removed.length) {
        const { error } = await admin
          .from('transactions')
          .delete()
          .in('plaid_transaction_id', result.removed.map((transaction) => transaction.transaction_id));
        if (error) throw error;
        removed += result.removed.length;
      }

      for (const account of result.accounts) {
        const databaseAccountId = accountsByPlaidId.get(account.account_id)?.id;
        if (!databaseAccountId) continue;
        const { error } = await admin.from('accounts').update({
          current_balance: account.balances.current,
          available_balance: account.balances.available,
          balance_updated_at: new Date().toISOString(),
        }).eq('id', databaseAccountId);
        if (error) throw error;
      }

      cursor = result.next_cursor;
      hasMore = result.has_more;
    }
  } catch (error) {
    const { code, message } = describePlaidError(error);
    await admin.from('plaid_items').update({
      last_sync_error: message,
      needs_reauth: code ? REAUTH_ERROR_CODES.has(code) : false,
    }).eq('item_id', itemId);
    throw new Error(message);
  }

  const { error: cursorError } = await admin.from('plaid_items').update({
    sync_cursor: cursor,
    last_synced_at: new Date().toISOString(),
    last_sync_error: null,
    needs_reauth: false,
  }).eq('item_id', itemId);
  if (cursorError) throw cursorError;

  const accountIds = Array.from(accountsByPlaidId.values()).map((account) => account.id);
  if (accountIds.length) await recategorizeUntouchedTransactions(admin, accountIds, categoryLookup, rules);

  return { added, modified, removed };
}

function inferOwnerAndBucket(accountName: string, institutionName: string): { owner: string; bucket: string } {
  const name = accountName.toLowerCase();
  // Brokerage/retirement/HSA/HYSA institutions are always a savings vehicle, regardless
  // of how the account itself is named.
  if (isSavingsVehicleInstitution(institutionName)) return { owner: 'joint', bucket: 'savings' };
  if (name.includes('alston') && name.includes('saving')) return { owner: 'alston', bucket: 'savings' };
  // Amex Platinum is used for discretionary spend, Amex Gold for household needs —
  // opposite of the generic joint-account default below.
  if (name.includes('platinum')) return { owner: 'joint', bucket: 'wants' };
  if (name.includes('gold')) return { owner: 'joint', bucket: 'needs' };
  if (name.includes('alston')) return { owner: 'alston', bucket: 'wants' };
  if (name.includes('sydney')) return { owner: 'wife', bucket: 'wants' };
  if (name.includes('joint')) return { owner: 'joint', bucket: 'needs' };
  return { owner: 'joint', bucket: 'needs' };
}

export async function hydratePlaidItemAccounts(itemId: string, institutionName = 'Connected institution') {
  const admin = createAdminClient();
  const { data: item, error: itemError } = await admin.from('plaid_items').select('access_token').eq('item_id', itemId).single<{ access_token: string }>();
  if (itemError || !item) throw itemError ?? new Error('Plaid Item was not found.');
  const response = await getPlaidClient().accountsGet({ access_token: item.access_token });
  for (const account of response.data.accounts) {
    const accountType = account.type === 'credit' ? 'credit' : account.type === 'depository' ? 'checking' : 'debit';
    const { owner, bucket } = inferOwnerAndBucket(account.name, institutionName);
    const { error } = await admin.from('accounts').upsert({
      name: account.name,
      institution: institutionName,
      owner,
      account_type: accountType,
      bucket,
      plaid_account_id: account.account_id,
      plaid_item_id: itemId,
      current_balance: account.balances.current,
      available_balance: account.balances.available,
      balance_updated_at: new Date().toISOString(),
    }, { onConflict: 'plaid_account_id' });
    if (error) throw error;
  }
}

export async function recoverOrphanedPlaidItems() {
  const admin = createAdminClient();
  const [{ data: items, error: itemsError }, { data: accounts, error: accountsError }] = await Promise.all([
    admin.from('plaid_items').select('item_id,institution_name'),
    admin.from('accounts').select('plaid_item_id'),
  ]);
  if (itemsError) throw itemsError;
  if (accountsError) throw accountsError;
  const linkedItemIds = new Set((accounts ?? []).map((account) => account.plaid_item_id));
  for (const item of items ?? []) {
    if (linkedItemIds.has(item.item_id)) continue;
    await hydratePlaidItemAccounts(item.item_id, item.institution_name ?? undefined);
    await syncPlaidItem(item.item_id);
  }
}

export async function syncAllPlaidItems() {
  const admin = createAdminClient();
  const { data: items, error } = await admin.from('plaid_items').select('item_id,institution_name');
  if (error) throw error;
  const results = [];
  for (const item of items ?? []) {
    try {
      results.push({ itemId: item.item_id, institutionName: item.institution_name, ok: true as const, result: await syncPlaidItem(item.item_id) });
    } catch (itemError) {
      results.push({ itemId: item.item_id, institutionName: item.institution_name, ok: false as const, error: describePlaidError(itemError).message });
    }
  }
  return results;
}

// Backfills transactions that were synced before auto-categorization existed, or that
// slipped through without a subcategory match. Never touches rows a human has edited.
async function recategorizeUntouchedTransactions(admin: ReturnType<typeof createAdminClient>, accountIds: string[], categoryLookup: CategoryLookup, rules: RuleEntry[]) {
  const { data: rows, error } = await admin
    .from('transactions')
    .select('id,name,original_description,account_id,amount,accounts(owner,bucket,account_type,institution)')
    .in('account_id', accountIds)
    .eq('is_manually_edited', false)
    .eq('is_ignored', false)
    .is('category_id', null);
  if (error) throw error;
  if (!rows) return;

  const transferIds: string[] = [];
  const idsByCategory = new Map<string, string[]>();

  for (const row of rows) {
    const accountInfo = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
    if (!accountInfo) continue;
    if (isTransfer(row.name, row.original_description)) {
      transferIds.push(row.id);
      continue;
    }
    const isDeposit = Number(row.amount) < 0;
    const categoryId = isDeposit
      ? resolveDepositCategoryId(categoryLookup, categorizeDeposit({ accountType: accountInfo.account_type, institution: accountInfo.institution, bucket: accountInfo.bucket }))
      : (() => {
          const ruleCategoryId = matchRuleCategoryId(row.name, row.original_description, rules);
          const subcategory = ruleCategoryId ? null : matchSubcategoryName(row.name, row.original_description, accountInfo.bucket as 'needs' | 'wants' | 'joint' | 'savings');
          return ruleCategoryId ?? resolveCategoryId(categoryLookup, accountInfo.bucket, subcategory);
        })();
    if (!categoryId) continue;
    const ids = idsByCategory.get(categoryId) ?? [];
    ids.push(row.id);
    idsByCategory.set(categoryId, ids);
  }

  if (transferIds.length) {
    const { error: transferError } = await admin.from('transactions').update({ is_ignored: true }).in('id', transferIds);
    if (transferError) throw transferError;
  }
  for (const [categoryId, ids] of Array.from(idsByCategory.entries())) {
    const { error: categoryError } = await admin.from('transactions').update({ category_id: categoryId }).in('id', ids);
    if (categoryError) throw categoryError;
  }
}

function toTransactionRow(transaction: PlaidTransaction, account: AccountInfo | undefined, categoryLookup: CategoryLookup, rules: RuleEntry[], isNew: boolean) {
  if (!account) return null;
  const name = transaction.merchant_name ?? transaction.name;
  const originalDescription = transaction.original_description ?? transaction.name;
  const base = {
    account_id: account.id,
    date: transaction.date,
    name,
    original_description: originalDescription,
    amount: transaction.amount,
    owner: account.owner as 'alston' | 'wife' | 'joint',
    plaid_transaction_id: transaction.transaction_id,
    pending: transaction.pending,
  };
  // Only newly-added transactions get an auto-computed category/ignore flag — a
  // "modified" row may already carry a manual edit that must not be overwritten.
  if (!isNew) return base;
  const plaidPrimaryCategory = (transaction as unknown as { personal_finance_category?: { primary?: string } }).personal_finance_category?.primary ?? null;
  const transfer = isTransfer(name, originalDescription, plaidPrimaryCategory);
  // Deposits (negative amount) are money coming in — either income or a savings
  // contribution, never spend — so they never land in a needs/wants subcategory.
  const isDeposit = Number(transaction.amount) < 0;
  const ruleCategoryId = transfer || isDeposit ? null : matchRuleCategoryId(name, originalDescription, rules);
  const subcategory = transfer || isDeposit || ruleCategoryId ? null : matchSubcategoryName(name, originalDescription, account.bucket as 'needs' | 'wants' | 'joint' | 'savings');
  const categoryId = transfer
    ? null
    : isDeposit
      ? resolveDepositCategoryId(categoryLookup, categorizeDeposit({ accountType: account.accountType, institution: account.institution, bucket: account.bucket }))
      : ruleCategoryId ?? resolveCategoryId(categoryLookup, account.bucket, subcategory);
  return { ...base, category_id: categoryId, is_ignored: transfer };
}
