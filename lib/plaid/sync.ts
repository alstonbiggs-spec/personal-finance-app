import type { Transaction as PlaidTransaction } from 'plaid';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlaidClient } from '@/lib/plaid/client';

type PlaidItem = { id: string; item_id: string; access_token: string; sync_cursor: string | null };

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
    .select('id,plaid_account_id')
    .eq('plaid_item_id', itemId);
  if (accountsError) throw accountsError;
  const accountIds = new Map((linkedAccounts ?? []).map((account) => [account.plaid_account_id, account.id]));

  const plaid = getPlaidClient();
  let cursor = item.sync_cursor ?? '';
  let hasMore = true;
  let added = 0;
  let modified = 0;
  let removed = 0;

  while (hasMore) {
    const response = await plaid.transactionsSync({
      access_token: item.access_token,
      cursor,
      count: 500,
      options: { include_original_description: true },
    });
    const result = response.data;

    if (result.added.length || result.modified.length) {
      const rows = [...result.added, ...result.modified]
        .map((transaction) => toTransactionRow(transaction, accountIds.get(transaction.account_id)))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
      if (rows.length) {
        const { error } = await admin.from('transactions').upsert(rows, { onConflict: 'plaid_transaction_id' });
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
      const databaseAccountId = accountIds.get(account.account_id);
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

  const { error: cursorError } = await admin.from('plaid_items').update({
    sync_cursor: cursor,
    last_synced_at: new Date().toISOString(),
  }).eq('item_id', itemId);
  if (cursorError) throw cursorError;

  return { added, modified, removed };
}

function toTransactionRow(transaction: PlaidTransaction, accountId: string | undefined) {
  if (!accountId) return null;
  return {
    account_id: accountId,
    date: transaction.date,
    name: transaction.merchant_name ?? transaction.name,
    original_description: transaction.original_description ?? transaction.name,
    amount: transaction.amount,
    owner: 'joint' as const,
    plaid_transaction_id: transaction.transaction_id,
    pending: transaction.pending,
  };
}
