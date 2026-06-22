# Wallet Balance Sync - Final Implementation Guide

## Problem Fixed

Wallet balances were being incorrectly calculated and showing as 0 due to:
1. Savings transactions being included in wallet balance calculations
2. Debt transactions being included in wallet balance calculations
3. Wallet balance not being properly synchronized from initial_balance

## Solution Implemented

**Corrected Formula**: 
```
current_balance = initial_balance + income - expense
```

Only **Income** and **Expense** transactions affect wallet balance.
**Savings** and **Debt** are tracked separately and do NOT affect wallet balance.

### Key Features

✅ **Wallet Balance** (Stored in `current_balance`):
- Bank: 1,379,000 - 1,630,000 (rent expense) = **-251,000**
- Cash: [calculated from income/expense transactions only]
- Negative values fully supported

✅ **Savings** (Tracked separately):
- Sum of all `kind='savings'` transactions
- Does NOT affect wallet balance
- Added to Total Assets separately

✅ **Total Assets**:
- Formula: `walletSum + savingsPot`
- Wallets + Savings combined

## Database Changes

### Migration 1: `20260623_add_wallet_balance_sync.sql`

Adds column, initializes balance, and creates three triggers:

**Current Balance Initialization**:
```sql
UPDATE public.wallets SET current_balance = initial_balance;
```

**Triggers** (Auto-sync on transaction changes):
- `update_wallet_balance_on_insert()` - Income/Expense transactions add/subtract
- `update_wallet_balance_on_update()` - Edit updates balance delta
- `update_wallet_balance_on_delete()` - Delete reverses the transaction effect

**Transaction Types Handled**:
- `income` → +amount (adds to balance)
- `expense` → -amount (subtracts from balance)
- `savings` → 0 (no effect on wallet balance)
- `debt` → 0 (no effect on wallet balance)

### Migration 2: `20260624_recalculate_wallet_balances.sql`

Recalculates all existing wallet balances using correct formula:
```sql
UPDATE public.wallets
SET current_balance = initial_balance + COALESCE(
  (
    SELECT SUM(
      CASE
        WHEN kind = 'income' THEN amount
        WHEN kind = 'expense' THEN -amount
        ELSE 0
      END
    )
    FROM transactions
    WHERE wallet_id = wallets.id
    AND kind != 'savings'
  ), 0
);
```

## Frontend Implementation (Already Complete)

Both pages read `current_balance` directly from wallets table:

**Wallets Page** (`src/routes/_authenticated/wallets.tsx`):
```tsx
<p>{formatVND(Number((w as any).current_balance ?? 0))}</p>
```

**Overview/Dashboard** (`src/routes/_authenticated/index.tsx`):
```tsx
const balanceByWalletId = useMemo(() => {
  const map = new Map<string, number>();
  for (const w of wallets.data ?? []) {
    map.set(w.id, Number((w as any).current_balance ?? 0));
  }
  return map;
}, [wallets.data]);
```

**Savings** (Calculated separately):
```tsx
const savingsPot = useMemo(
  () => txs.data?.filter(t => t.kind === 'savings').reduce((a, t) => a + Number(t.amount), 0) ?? 0,
  [txs.data],
);
```

## Deployment Steps

1. **Run Migration 1** - Adds column, initializes data, creates triggers
   ```
   20260623_add_wallet_balance_sync.sql
   ```

2. **Run Migration 2** - Recalculates all wallet balances
   ```
   20260624_recalculate_wallet_balances.sql
   ```

3. **Deploy Frontend** - No code changes needed, already implemented

4. **Verify**:
   - Bank wallet shows -251,000đ (not 0)
   - Wallets page balance = Overview balance
   - Savings shown separately
   - Total Assets = Wallets + Savings

## Testing Checklist

- [ ] Bank wallet balance = -251,000đ (or previous value)
- [ ] Cash wallet balance = correct calculated value
- [ ] Wallets page and Overview show same balance
- [ ] Create income transaction → wallet balance increases
- [ ] Create expense transaction → wallet balance decreases
- [ ] Create savings transaction → wallet balance NOT affected
- [ ] Edit transaction → balance updates correctly
- [ ] Delete transaction → balance reverts correctly
- [ ] Total Assets = wallet sum + savings sum

## Query Reference

**Check wallet balances**:
```sql
SELECT id, name, initial_balance, current_balance 
FROM public.wallets 
ORDER BY created_at;
```

**Check transaction counts by type**:
```sql
SELECT kind, COUNT(*), SUM(amount) as total
FROM transactions
GROUP BY kind;
```

**Manually recalculate a wallet** (if needed):
```sql
UPDATE public.wallets
SET current_balance = initial_balance + COALESCE(
  (SELECT SUM(CASE WHEN kind='income' THEN amount WHEN kind='expense' THEN -amount ELSE 0 END)
   FROM transactions WHERE wallet_id = 'wallet_id' AND kind != 'savings'),
  0
)
WHERE id = 'wallet_id';
```
