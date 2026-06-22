# Wallet Balance Calculation - Complete Debt Logic Implementation

## What Was Fixed

The wallet balance calculation now correctly handles debt transactions:

### Before (Incomplete)
```
Wallet Balance = initial_balance + income - expense
```
Issues: Debt transactions were ignored, wallet didn't reflect real cash flow

### After (Complete)
```
Wallet Balance = initial_balance + income - expense ± debt_effect
```
Where:
- **Lending (Cho nợ)**: -amount (money leaves wallet)
- **Borrowing/Other Debt**: +amount or -amount (per transaction)
- **Savings**: Excluded (0 effect)

## Core Implementation

### Database Triggers (3 Functions)

All triggers follow the same debt logic:

```sql
IF kind = 'income' THEN
  delta := amount;
ELSIF kind = 'expense' THEN
  delta := -amount;
ELSIF kind = 'debt' THEN
  SELECT category.name...
  IF category.name = 'Cho nợ' THEN
    delta := -amount;  -- Lending: money goes out
  ELSE
    delta := amount;   -- Borrowing: money comes in
  END IF;
ELSIF kind = 'savings' THEN
  delta := 0;  -- Savings don't affect wallet
END IF;
```

### Trigger Functions

1. **`update_wallet_balance_on_insert()`**
   - Fires when transaction is created
   - Calculates delta and updates wallet balance

2. **`update_wallet_balance_on_update()`**
   - Fires when transaction is edited
   - Removes old delta, applies new delta

3. **`update_wallet_balance_on_delete()`**
   - Fires when transaction is deleted
   - Removes delta from wallet balance

### Recalculation Query

For one-time recalculation (in migration or manual fix):

```sql
UPDATE wallets
SET current_balance = initial_balance + COALESCE(
  (SELECT SUM(
    CASE
      WHEN kind = 'income' THEN amount
      WHEN kind = 'expense' THEN -amount
      WHEN kind = 'debt' THEN (
        CASE
          WHEN c.name = 'Cho nợ' THEN -amount
          ELSE amount
        END
      )
      ELSE 0
    END
  )
  FROM transactions t
  LEFT JOIN categories c ON t.category_id = c.id
  WHERE t.wallet_id = wallets.id
  AND kind != 'savings'),
  0
);
```

## Expected Behavior Examples

### Example 1: Lending Money
```
Initial: Bank = 5,000,000đ
Action: Lend 500,000đ to friend (Cho nợ)
  - Transaction: kind='debt', amount=500000, category_id='Cho nợ'
  - Trigger: delta = -500000
Result: Bank = 4,500,000đ
Note: Debt receivable tracked separately, not in wallet
```

### Example 2: Borrowing Money
```
Initial: Bank = 4,500,000đ
Action: Borrow 1,000,000đ (Khoản nợ)
  - Transaction: kind='debt', amount=1000000, category_id='Khoản nợ'
  - Trigger: delta = 1000000
Result: Bank = 5,500,000đ
Note: This money now in wallet, debt payable tracked separately
```

### Example 3: Repaying Debt
```
Initial: Bank = 5,500,000đ
Action: Repay 500,000đ of debt (Khoản nợ with amount=-500000)
  - Transaction: kind='debt', amount=-500000, category_id='Khoản nợ'
  - Trigger: delta = -500000 (amount is already negative)
Result: Bank = 5,000,000đ
Note: Money leaves wallet to pay creditor
```

### Example 4: Savings (Excluded)
```
Initial: Bank = 5,000,000đ
Action: Save 500,000đ
  - Transaction: kind='savings', amount=500000
  - Trigger: delta = 0 (savings don't affect wallet)
Result: Bank = 5,000,000đ (unchanged)
Note: Savings tracked separately, added to total assets
```

## Files Modified

1. **`supabase/migrations/20260623_add_wallet_balance_sync.sql`**
   - Updated all 3 trigger functions with debt logic
   - Checks category name "Cho nợ" for lending identification

2. **`supabase/migrations/20260624_recalculate_wallet_balances.sql`**
   - Updated recalculation query with debt logic
   - Joins categories table to identify lending

## Frontend Ready

The frontend code already:
- ✅ Reads `current_balance` directly from database
- ✅ Displays same balance on Wallet page and Overview
- ✅ Tracks Savings separately
- ✅ Calculates Total Assets correctly

## Deployment

1. Run migration 1: `20260623_add_wallet_balance_sync.sql`
2. Run migration 2: `20260624_recalculate_wallet_balances.sql`
3. Verify with tests in deployment checklist

## Key Differences from Previous Version

| Aspect | Old | New |
|--------|-----|-----|
| Debt Logic | Missing | Complete |
| Lending Support | No | Yes (Cho nợ = -amount) |
| Borrowing Support | No | Yes (Khoản nợ = +amount) |
| Savings Handling | Included in wallet | Excluded |
| Real Cash Flow | No | Yes |
| Frontend | Updated | Updated |
| Database Triggers | Limited | Full coverage |

## Verification Quick Test

```sql
-- Check one wallet with debt transaction
SELECT 
  w.name,
  w.initial_balance,
  w.current_balance,
  (SELECT COUNT(*) FROM transactions 
   WHERE wallet_id = w.id AND kind = 'debt') as debt_count
FROM wallets w
LIMIT 1;
```

If working correctly:
- `current_balance` should not equal `initial_balance` if transactions exist
- `current_balance` should reflect income/expense/debt changes
- `current_balance` should NOT include savings
