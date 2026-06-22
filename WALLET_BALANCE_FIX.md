# Wallet Balance Synchronization Fix

## Problem Statement

The application had inconsistent wallet balance displays across pages because:

1. **No persistent balance field** - Wallets table only had `initial_balance` (set once at creation, never updated)
2. **Frontend recalculation** - Every page had to recalculate balance from transactions
3. **Multiple calculations** - Different pages used different logic → inconsistent results
4. **Data loss risk** - Migrating without preserving existing balances

### Example Issue
- Bank wallet: -251,000đ (existing balance from before transactions)
- Cash wallet: X (existing balance)
- After incorrect migration: Both became 0 (lost existing data)

## Solution Architecture

### Single Source of Truth

Changed from a **frontend-calculated model** to a **database-maintained model**:

```
BEFORE (❌ Wrong):
┌─────────────────────────────────────────────┐
│ Wallets Table                               │
│ - id                                        │
│ - initial_balance (never updated)           │
└─────────────────────────────────────────────┘
         ↓ (independent calculations)
┌──────────────────────────────────────┐
│ Overview Page                        │
│ Calculates: initial_balance + Σtx   │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ Wallets Page                         │
│ Calculates: initial_balance + Σtx   │
└──────────────────────────────────────┘
(Different results = inconsistent UI ❌)

AFTER (✅ Correct):
┌──────────────────────────────────────┐
│ Transactions Table                   │
│ - id, wallet_id, kind, amount, ...   │
└──────────────────────────────────────┘
         ↓ (INSERT/UPDATE/DELETE)
    [DB TRIGGER]
         ↓
┌──────────────────────────────────────┐
│ Wallets Table                        │
│ - id                                 │
│ - initial_balance (set once)         │
│ - current_balance (auto-synced) ✨  │
└──────────────────────────────────────┘
         ↓ (read only)
┌──────────────────────────────────────┐
│ All Frontend Pages                   │
│ Read: current_balance                │
└──────────────────────────────────────┘
(Same value everywhere = consistent UI ✅)
```

### Database Changes

**Primary Migration**: `20260623_add_wallet_balance_sync.sql`

1. **Added `current_balance` column** to wallets table
   - Type: `NUMERIC(18,2)`
   - Default: 0
   - **Preserves existing balance**: Copies `initial_balance` → `current_balance`
   - ✅ Does NOT recalculate from transactions
   - ✅ Preserves existing wallet data

2. **Created 3 trigger functions** to maintain balance going forward:
   - `update_wallet_balance_on_insert()` - When transaction is created
   - `update_wallet_balance_on_update()` - When transaction is edited
   - `update_wallet_balance_on_delete()` - When transaction is deleted

3. **Trigger Logic** (applies to NEW transactions only):
   - **Income**: +amount
   - **Expense**: -amount
   - **Savings**: -amount (negative withdraws, positive saves)
   - **Debt**: -amount if "Cho nợ" (lending), +amount otherwise (borrowing)

**Recovery Migration**: `20260623_restore_wallet_balances.sql` (if needed)
- If initial migration incorrectly reset balances to 0
- Restores `current_balance` from `initial_balance` for all wallets
- Run this AFTER the primary migration if data was lost

### Frontend Changes

#### Simplifications Made

1. **Removed duplicate balance calculation** from all pages
   - Deleted 60+ lines of complex memoization logic
   - Removed unnecessary transaction and category queries

2. **Updated balance reading**:
   ```typescript
   // BEFORE (recalculated every render)
   const balances = useMemo(() => {
     // 30+ lines of calculation logic
     // recalculate from initial_balance + all transactions
   }, [wallets.data, txs.data, cats.data]);

   // AFTER (read from DB)
   const balanceByWalletId = useMemo(() => {
     const map = new Map<string, number>();
     for (const w of wallets.data ?? []) {
       map.set(w.id, Number((w as any).current_balance ?? 0));
     }
     return map;
   }, [wallets.data]);
   ```

3. **Updated files**:
   - `src/routes/_authenticated/wallets.tsx` - Removed transaction queries and calculation logic
   - `src/routes/_authenticated/index.tsx` - Simplified balance calculation to single DB read
   - `src/components/QuickAdd.tsx` - Added wallets query invalidation after transaction insert
   - `src/components/EditTransactionModal.tsx` - Added wallets query invalidation after transaction update
   - `src/routes/_authenticated/categories.tsx` - Added wallets query invalidation after transaction delete

4. **Cache Invalidation**:
   - All transaction mutations now invalidate both `["transactions"]` and `["wallets"]` queries
   - This ensures UI immediately reflects database changes from triggers

## How It Works

### Workflow for Creating a Transaction

1. User creates transaction via QuickAdd: `20k coffee`
2. Frontend: `POST /transactions` inserts into DB
3. **Database Trigger** automatically executes:
   ```sql
   UPDATE wallets 
   SET current_balance = current_balance + (-20000)
   WHERE id = <wallet_id>
   ```
4. Frontend: Receives success, invalidates both query caches
5. Next render: Reads `current_balance` from wallet - UI updates immediately ✅

### Workflow for Editing a Transaction

1. User changes transaction: `20k` → `50k`
2. Frontend: `PUT /transactions/{id}` updates DB
3. **Database Trigger** automatically:
   - Removes old delta: `current_balance = current_balance - (-20000) = +20000`
   - Applies new delta: `current_balance = current_balance + (-50000) = -50000`
   - Net effect: `current_balance - 30000` ✅
4. Frontend: Invalidates caches, rerenders with new balance

### Workflow for Deleting a Transaction

1. User deletes transaction: `20k coffee`
2. Frontend: `DELETE /transactions/{id}`
3. **Database Trigger** automatically:
   ```sql
   UPDATE wallets 
   SET current_balance = current_balance - (-20000)
   WHERE id = <wallet_id>
   ```
4. Frontend: Invalidates caches, balance returns to previous correct value ✅

## Consistency Guarantees

Now all pages show the **exact same wallet balance** because they all read from the same source:

| Page | What it reads | Result |
|------|---------------|--------|
| Wallets | `wallet.current_balance` | ✅ Correct |
| Overview | `wallet.current_balance` | ✅ Correct |
| Total Assets | Sum of `wallet.current_balance` | ✅ Correct |
| Debt/Savings | From transaction totals | ✅ Correct |
| Categories | Transaction details | ✅ Correct |

## Benefits

1. **Eliminates inconsistencies** - Single source of truth
2. **Performance improvement** - No more expensive transaction calculations
3. **Data integrity** - Database enforces balance updates
4. **Simplifies frontend** - 60+ lines of calculation code removed
5. **Easier maintenance** - Balance logic in one place (database)
6. **Real-time updates** - Triggers fire immediately on transaction changes

## Migration Steps

### If Starting Fresh (No Data Loss)
1. Run: `20260623_add_wallet_balance_sync.sql`
   - Adds `current_balance` column
   - Copies `initial_balance` → `current_balance` (preserves existing data)
   - Creates trigger functions and triggers
2. Deploy new frontend code
3. Test transactions create/edit/delete correctly

### If Data Was Lost (Balances Became 0)
1. Run: `20260623_restore_wallet_balances.sql`
   - Restores `current_balance` from `initial_balance` for all wallets
   - Example: Bank (-251,000đ) returns to correct value
2. Verify balances are restored
3. Deploy new frontend code

### Testing
- Create transaction → wallet balance updates immediately
- Edit transaction → balance recalculates (removes old delta, applies new)
- Delete transaction → balance returns to previous correct state
- All pages (Overview, Wallets, Total Assets) show identical balance
- Debt/Savings calculations remain correct

## Debugging

If balances are inconsistent:

1. Check if migration ran successfully
2. Verify triggers exist:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE 'on_transaction_%';
   ```
3. Check `wallets.current_balance` values match transaction calculations
4. Manual sync (if needed):
   ```sql
   UPDATE wallets w
   SET current_balance = initial_balance + COALESCE((
     SELECT SUM(...)  -- same calculation as migration
   ), 0);
   ```
