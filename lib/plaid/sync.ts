import type { Transaction as PlaidTransaction } from 'plaid';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlaidClient } from '@/lib/plaid/client';
import { categorizeDeposit, isSavingsVehicleInstitution, isSavingsVehicleTransferText, isTransfer, matchSubcategoryName, parentCategoryForBucket, textMentionsInstitution } from '@/lib/plaid/categorize';

type PlaidItem = { id: string; item_id: string; access_token: string; sync_cursor: string | null };
type AccountInfo = { id: string; owner: string; bucket: string; accountType: string; institution: string };
type AdminClient = ReturnType<typeof createAdminClient>;
type CategoryLookup = Map<string, string>;
type RuleEntry = { pattern: string; categoryId: string; parentCategory: string | null };
type NamedCategory = { id: string; name: string };
// Everything the categorizer needs from the database, loaded once per sync.
type ClassifyContext = { categoryLookup: CategoryLookup; savingsCategories: NamedCategory[]; rules: RuleEntry[]; connectedSavingsInstitutions: string[] };
type Classification = { categoryId: string | null; isIgnored: boolean };

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

async function loadClassifyContext(admin: AdminClient): Promise<ClassifyContext> {
  const [{ data: categories }, rules, connectedSavingsInstitutions] = await Promise.all([
    admin.from('categories').select('id,name,parent_category,sort_order').order('sort_order'),
    loadRules(admin),
    loadConnectedSavingsInstitutions(admin),
  ]);
  const categoryLookup: CategoryLookup = new Map();
  for (const category of categories ?? []) categoryLookup.set(categoryKey(category.parent_category, category.name), category.id);
  const savingsCategories = (categories ?? []).filter((category) => category.parent_category === 'savings').map(({ id, name }) => ({ id, name }));
  return { categoryLookup, savingsCategories, rules, connectedSavingsInstitutions };
}

function resolveCategoryId(lookup: CategoryLookup, bucket: string, subcategoryName: string | null): string | null {
  const parent = parentCategoryForBucket(bucket);
  if (subcategoryName) {
    const specific = lookup.get(categoryKey(parent, subcategoryName));
    if (specific) return specific;
  }
  return lookup.get(categoryKey(parent, 'Other')) ?? null;
}

// Savings categories are named by the household (e.g. "HYSA", "INVESTMENTS (Fidelity)")
// rather than drawn from a fixed list, so pick the one whose name mentions an institution in
// the transaction text, then "Other", then the first savings category. Returning null would
// leave the row uncategorized, and an uncategorized deposit never counts toward "saved".
function resolveSavingsCategoryId(context: ClassifyContext, text: string): string | null {
  // Raw bank descriptors that don't spell out the institution's name.
  const expanded = text.replace(/fid bkg svc/gi, 'Fidelity $&');
  const named = context.savingsCategories.find((category) => textMentionsInstitution(expanded, category.name));
  if (named) return named.id;
  return context.categoryLookup.get(categoryKey('savings', 'Other')) ?? context.savingsCategories[0]?.id ?? null;
}

function resolveDepositCategoryId(context: ClassifyContext, parent: 'income' | 'savings' | null, text: string): string | null {
  if (parent === 'savings') return resolveSavingsCategoryId(context, text);
  if (parent === 'income') return context.categoryLookup.get(categoryKey('income', 'Other')) ?? null;
  return null;
}

// Learned merchant → category rules (see lib/rules/remember-category.ts), created whenever
// a user manually reassigns a transaction. Checked before the generic keyword matcher.
async function loadRules(admin: AdminClient): Promise<RuleEntry[]> {
  const { data } = await admin.from('rules').select('match_pattern,apply_category_id,categories(parent_category)');
  return (data ?? []).map((rule) => {
    const category = (Array.isArray(rule.categories) ? rule.categories[0] : rule.categories) as { parent_category?: string } | null;
    return { pattern: rule.match_pattern.toLowerCase(), categoryId: rule.apply_category_id, parentCategory: category?.parent_category ?? null };
  });
}

function matchRuleCategoryId(name: string, originalDescription: string, rules: RuleEntry[], allowedParents?: string[]): string | null {
  const text = `${name} ${originalDescription}`.toLowerCase();
  for (const rule of rules) {
    if (allowedParents && !allowedParents.includes(rule.parentCategory ?? '')) continue;
    if (rule.pattern && text.includes(rule.pattern)) return rule.categoryId;
  }
  return null;
}

// Institutions of the household's connected savings accounts whose deposits actually arrive
// over Plaid Transactions: depository accounts like an Ally HYSA (account_type "checking").
// An outgoing transfer naming one of these is already counted via that account's own deposit,
// so it stays an ignored internal transfer. Investment accounts (Fidelity, Vanguard; stored as
// account_type "debit") are deliberately excluded: Plaid Transactions reports no activity for
// them, so the outgoing leg from checking is the only record of the money being saved and must
// count as savings even though the brokerage itself is connected.
async function loadConnectedSavingsInstitutions(admin: AdminClient): Promise<string[]> {
  const { data } = await admin.from('accounts').select('institution').eq('bucket', 'savings').eq('account_type', 'checking');
  return (data ?? []).map((row) => row.institution);
}

function isUnconnectedSavingsVehicleTransfer(name: string, originalDescription: string, isDeposit: boolean, connectedSavingsInstitutions: string[]): boolean {
  if (isDeposit || !isSavingsVehicleTransferText(name, originalDescription)) return false;
  const text = `${name} ${originalDescription}`;
  return !connectedSavingsInstitutions.some((institution) => textMentionsInstitution(text, institution));
}

// Single source of truth for auto-categorization, shared by newly synced rows and the
// backfill of untouched rows.
function classifyTransaction(transaction: { name: string; originalDescription: string; amount: number; plaidPrimaryCategory?: string | null }, account: Pick<AccountInfo, 'owner' | 'bucket' | 'accountType' | 'institution'>, context: ClassifyContext): Classification {
  const { name, originalDescription } = transaction;
  const text = `${name} ${originalDescription}`;
  // Deposits (negative amount) are money coming in — either income or a savings
  // contribution, never spend — so they never land in a needs/wants subcategory.
  const isDeposit = Number(transaction.amount) < 0;
  const depositCategory = isDeposit ? categorizeDeposit(account) : null;
  // An outgoing transfer to a savings/investment institution whose deposits Plaid doesn't
  // report (e.g. an ACH into Fidelity) is the only record of that money being saved.
  if (isUnconnectedSavingsVehicleTransfer(name, originalDescription, isDeposit, context.connectedSavingsInstitutions)) {
    return { categoryId: resolveSavingsCategoryId(context, text), isIgnored: false };
  }
  // A transfer-shaped deposit landing in a savings account (Ally, or any account already
  // bucketed as savings) is the "money saved" event itself, so it's never ignored even
  // though the description reads like a transfer. Every other transfer/card-payment/
  // brokerage-shaped transaction — including a transfer-shaped deposit landing anywhere
  // else, like an internal sweep into the joint checking account — stays ignored, since
  // that money was already counted when it first entered one of the household's accounts.
  if (depositCategory !== 'savings' && isTransfer(name, originalDescription, transaction.plaidPrimaryCategory)) {
    return { categoryId: null, isIgnored: true };
  }
  if (isDeposit) {
    // Only income/savings rules apply to money coming in, so a needs rule like "Amazon"
    // can't pull an Amazon refund into spend.
    const ruleCategoryId = matchRuleCategoryId(name, originalDescription, context.rules, ['income', 'savings']);
    return { categoryId: ruleCategoryId ?? resolveDepositCategoryId(context, depositCategory, `${text} ${account.institution}`), isIgnored: false };
  }
  const ruleCategoryId = matchRuleCategoryId(name, originalDescription, context.rules);
  if (ruleCategoryId) return { categoryId: ruleCategoryId, isIgnored: false };
  const subcategory = matchSubcategoryName(name, originalDescription, account.bucket as 'needs' | 'wants' | 'joint' | 'savings', account.owner);
  return { categoryId: resolveCategoryId(context.categoryLookup, account.bucket, subcategory), isIgnored: false };
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
  const context = await loadClassifyContext(admin);

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
          .map((transaction) => toTransactionRow(transaction, accountsByPlaidId.get(transaction.account_id), context, true))
          .filter((row): row is NonNullable<typeof row> => Boolean(row));

        // A manually-edited row may also have a hand-corrected name/amount/date — those
        // must never be clobbered by Plaid resending the same transaction as "modified",
        // so look up which modified rows are protected before building their update payload.
        const modifiedIds = result.modified.map((transaction) => transaction.transaction_id);
        const editedByPlaidId = new Map<string, boolean>();
        if (modifiedIds.length) {
          const { data: existingRows, error: existingError } = await admin
            .from('transactions')
            .select('plaid_transaction_id,is_manually_edited')
            .in('plaid_transaction_id', modifiedIds);
          if (existingError) throw existingError;
          for (const row of existingRows ?? []) editedByPlaidId.set(row.plaid_transaction_id, row.is_manually_edited);
        }
        const updatedRowsOpen: NonNullable<ReturnType<typeof toTransactionRow>>[] = [];
        const updatedRowsProtected: Partial<NonNullable<ReturnType<typeof toTransactionRow>>>[] = [];
        for (const transaction of result.modified) {
          const row = toTransactionRow(transaction, accountsByPlaidId.get(transaction.account_id), context, false);
          if (!row) continue;
          if (editedByPlaidId.get(transaction.transaction_id)) {
            const { amount: _amount, date: _date, name: _name, ...protectedFields } = row;
            updatedRowsProtected.push(protectedFields);
          } else {
            updatedRowsOpen.push(row);
          }
        }
        // Kept as separate requests: PostgREST's bulk upsert requires every row in one
        // request to share the same set of keys, and these batches don't.
        if (newRows.length) {
          const { error } = await admin.from('transactions').upsert(newRows, { onConflict: 'plaid_transaction_id' });
          if (error) throw error;
        }
        if (updatedRowsOpen.length) {
          const { error } = await admin.from('transactions').upsert(updatedRowsOpen, { onConflict: 'plaid_transaction_id' });
          if (error) throw error;
        }
        if (updatedRowsProtected.length) {
          const { error } = await admin.from('transactions').upsert(updatedRowsProtected, { onConflict: 'plaid_transaction_id' });
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

  // Balances come from /accounts/get rather than /transactions/sync: sync only reports
  // accounts that had transaction activity, so investment accounts (which never do) would
  // otherwise keep their balance from the day they were linked.
  try {
    const { data: balances } = await plaid.accountsGet({ access_token: item.access_token });
    for (const account of balances.accounts) {
      const databaseAccountId = accountsByPlaidId.get(account.account_id)?.id;
      if (!databaseAccountId) continue;
      const { error } = await admin.from('accounts').update({
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        balance_updated_at: new Date().toISOString(),
      }).eq('id', databaseAccountId);
      if (error) throw error;
    }
  } catch (balanceError) {
    // Transactions already synced fine; a stale balance shouldn't fail the whole sync.
    console.error('Plaid balance refresh failed', { itemId, error: describePlaidError(balanceError).message });
  }

  const accountIds = Array.from(accountsByPlaidId.values()).map((account) => account.id);
  if (accountIds.length) await recategorizeUntouchedTransactions(admin, accountIds, context);

  return { added, modified, removed };
}

function inferOwnerAndBucket(accountName: string, institutionName: string): { owner: string; bucket: string } {
  const name = accountName.toLowerCase();
  // Brokerage/retirement/HSA/HYSA institutions are always a savings vehicle, regardless
  // of how the account itself is named.
  if (isSavingsVehicleInstitution(institutionName)) return { owner: 'joint', bucket: 'savings' };
  if (name.includes('alston') && name.includes('saving')) return { owner: 'alston', bucket: 'savings' };
  // Amex Platinum is Alston's personal discretionary card; Amex Gold is the household
  // needs card — opposite of the generic joint-account default below.
  if (name.includes('platinum')) return { owner: 'alston', bucket: 'wants' };
  if (name.includes('gold')) return { owner: 'joint', bucket: 'needs' };
  // Wife's personal Bank of America card — every charge on it is discretionary spend.
  if (name.includes('travel rewards')) return { owner: 'wife', bucket: 'wants' };
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
// slipped through without a category (e.g. a savings deposit synced while no savings
// category could be resolved). Never touches rows a human has edited.
async function recategorizeUntouchedTransactions(admin: AdminClient, accountIds: string[], context: ClassifyContext) {
  const { data: rows, error } = await admin
    .from('transactions')
    .select('id,name,original_description,account_id,amount,accounts(owner,bucket,account_type,institution)')
    .in('account_id', accountIds)
    .eq('is_manually_edited', false)
    .eq('is_ignored', false)
    .is('category_id', null);
  if (error) throw error;

  const transferIds: string[] = [];
  const idsByCategory = new Map<string, string[]>();
  const addToCategory = (categoryId: string, id: string) => idsByCategory.set(categoryId, [...(idsByCategory.get(categoryId) ?? []), id]);

  for (const row of rows ?? []) {
    const accountInfo = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
    if (!accountInfo) continue;
    const { categoryId, isIgnored } = classifyTransaction(
      { name: row.name, originalDescription: row.original_description, amount: Number(row.amount) },
      { owner: accountInfo.owner, bucket: accountInfo.bucket, accountType: accountInfo.account_type, institution: accountInfo.institution },
      context,
    );
    if (isIgnored) transferIds.push(row.id);
    else if (categoryId) addToCategory(categoryId, row.id);
  }

  if (transferIds.length) {
    const { error: transferError } = await admin.from('transactions').update({ is_ignored: true }).in('id', transferIds);
    if (transferError) throw transferError;
  }

  // Reclaim: outgoing transfers to a savings/investment institution with no deposit feed
  // (e.g. Fidelity) that were previously discarded as ignored internal transfers — including
  // ones that had picked up a needs/wants category before being ignored. Rows a human has
  // edited are never touched, and a fixed row stops matching (it's no longer ignored), so
  // this is safe to run on every sync.
  const { data: ignoredRows, error: ignoredError } = await admin
    .from('transactions')
    .select('id,name,original_description,amount')
    .in('account_id', accountIds)
    .eq('is_manually_edited', false)
    .eq('is_ignored', true);
  if (ignoredError) throw ignoredError;
  const reclaimIdsByCategory = new Map<string, string[]>();
  for (const row of ignoredRows ?? []) {
    if (!isUnconnectedSavingsVehicleTransfer(row.name, row.original_description, Number(row.amount) < 0, context.connectedSavingsInstitutions)) continue;
    const categoryId = resolveSavingsCategoryId(context, `${row.name} ${row.original_description}`);
    if (categoryId) reclaimIdsByCategory.set(categoryId, [...(reclaimIdsByCategory.get(categoryId) ?? []), row.id]);
  }
  for (const [categoryId, ids] of Array.from(reclaimIdsByCategory.entries())) {
    const { error: reclaimError } = await admin.from('transactions').update({ is_ignored: false, category_id: categoryId }).in('id', ids);
    if (reclaimError) throw reclaimError;
  }

  for (const [categoryId, ids] of Array.from(idsByCategory.entries())) {
    const { error: categoryError } = await admin.from('transactions').update({ category_id: categoryId }).in('id', ids);
    if (categoryError) throw categoryError;
  }
}

function toTransactionRow(transaction: PlaidTransaction, account: AccountInfo | undefined, context: ClassifyContext, isNew: boolean) {
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
  const { categoryId, isIgnored } = classifyTransaction({ name, originalDescription, amount: Number(transaction.amount), plaidPrimaryCategory }, account, context);
  return { ...base, category_id: categoryId, is_ignored: isIgnored };
}
