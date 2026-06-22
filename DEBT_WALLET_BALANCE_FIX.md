# Wallet Balance Fix - With Debt Transaction Logic

## Overview

The wallet balance calculation now correctly handles all transaction types while preserving real cash flow accounting:

- **Income** (+): Money enters wallet
- **Expense** (-): Money leaves wallet  
- **Debt** (±): Money flow based on transaction type
- **Savings** (0): Does NOT affect wallet balance

## Updated Formula

```
current_balance = initial_balance + income - expense ± debt_effect
```

Where debt_effect depends on category:
- **"Cho nợ" (Lending)**: -amount (money leaves wallet, enters debt receivable)
- **Other debt** (Borrowing/Repayment): +amount or -amount per transaction amount sign

## Example Scenario

### Before Debt
- Bank: 5,000,000đ
- Debt Receivable: 0

### Transaction: Lend 500,000đ (Cho nợ)
- Database records: kind='debt', amount=500000, category='Cho nợ'
- Trigger calculates: delta = -500000
- Result:
  - Bank: 4,500,000đ (decreased - money left wallet)
  - Debt Receivable: 500,000đ (tracked separately, not in wallet)

### Transaction: Borrower repays 500,000đ (Khoản nợ with negative amount)
- Database records: kind='debt', amount=-500000, category='Khoản nợ'  
- Trigger calculates: delta = -500000 (amount is already negative, so result is negative)
- Result:
  - Bank: 4,000,000đ (repayment received, wallet increases)

## Database Migrations

### Migration 1: `20260623_add_wallet_balance_sync.sql`
- Adds `current_balance` column
- Creates 3 trigger functions with debt logic
- Creates 3 database triggers (insert, update, delete)

**Trigger Logic for Each Function:**

```sql
-- Lending (Cho nợ):
IF category.name = 'Cho nợ' THEN
  delta := -amount  -- Money leaves wallet
ELSE
  delta := amount   -- Borrowing: use amount as-is
END IF;
```

### Migration 2: `20260624_recalculate_wallet_balances.sql`
- Recalculates all existing wallet balances
- Applies correct formula including debt logic
- Joins with categories table to identify lending vs borrowing

## Implementation Steps

1. **Deploy both migrations in order:**
   - First: `20260623_add_wallet_balance_sync.sql` (creates triggers)
   - Second: `20260624_recalculate_wallet_balances.sql` (recalculates balances)

2. **Verify results:**
   ```sql
   SELECT wallet_id, name, initial_balance, current_balance FROM wallets;
   ```

3. **Test debt transactions:**
   - Create "Cho nợ" (lending) transaction
   - Verify wallet balance decreased
   - Create "Khoản nợ" (borrowing) transaction
   - Verify wallet balance increased/decreased correctly

4. **Verify savings excluded:**
   - Create savings transaction
   - Verify wallet balance unchanged
   - Savings sum shown separately in dashboard

## Expected Results

### Wallet Page
- Shows wallet `current_balance` (affected by income, expense, debt)
- Savings shown separately in total assets

### Overview/Dashboard
- Wallet sum: Bank + Cash (excluding savings)
- Savings pot: Sum of all savings transactions
- Total assets: Wallet sum + Savings pot

### Example Final State
- Bank: -251,000đ (initial 1,379,000 - 1,630,000 rent expense)
- Cash: [correct calculated amount]
- Savings: [sum of savings transactions]
- Total Assets: Bank + Cash + Savings

## Transaction Type Reference

| Type | Kind | Category | Wallet Effect |
|------|------|----------|--------------|
| Income | income | Any | +amount |
| Expense | expense | Any | -amount |
| Lend Money | debt | Cho nợ | -amount |
| Borrow Money | debt | Khoản nợ | +amount |
| Repay Debt | debt | Khoản nợ | -amount (use negative) |
| Receive Repayment | debt | Cho nợ | +amount (use negative) |
| Save Money | savings | Any | 0 (not wallet) |

## Troubleshooting

If wallet balance shows 0:
1. Check that both migrations ran successfully
2. Verify `current_balance` column exists: `SELECT column_name FROM information_schema.columns WHERE table_name='wallets'`
3. Check triggers exist: `SELECT trigger_name FROM information_schema.triggers WHERE table_name='transactions'`
4. Manually recalculate: Run migration 2 again

If debt transactions not working:
1. Verify category name matches exactly "Cho nợ" (Vietnamese characters)
2. Check that category_id is set in transaction
3. Review trigger function with: `SELECT pg_get_functiondef('update_wallet_balance_on_insert'::regprocedure)`
