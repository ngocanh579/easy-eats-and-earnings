# Debt & Wallet Balance - Quick Reference

## Formula
```
Wallet Balance = Initial Balance + Income - Expense + Debt Cash Flow
```

## Debt Transaction Mapping

| Scenario | Category | Amount | Cash Flow | Wallet Effect |
|----------|----------|--------|-----------|---------------|
| Borrow money | Khoản nợ | 1,000,000 | +1,000,000 | Increase |
| Lend money | Cho nợ | 500,000 | -500,000 | Decrease |
| Receive repayment | Khoản nợ | 1,000,000 | +1,000,000 | Increase |
| Repay debt | Khoản nợ | -800,000 | -800,000 | Decrease |

## Category Decision Tree

```
Is it a debt transaction?
├─ Yes: Is category "Cho nợ"?
│  ├─ Yes (Lending) → delta = -amount → Wallet DECREASES
│  └─ No (Borrowing/Repayment) → delta = amount → Wallet changes by amount
└─ No: Is it income/expense/savings?
   ├─ Income → delta = +amount
   ├─ Expense → delta = -amount
   └─ Savings → delta = 0 (not included in wallet)
```

## Example Calculations

### Initial: 5,000,000đ

**Borrow 2,000,000:**
- delta = +2,000,000
- Result: 7,000,000đ ✓

**Lend 1,500,000:**
- delta = -1,500,000
- Result: 5,500,000đ ✓

**Expense 500,000:**
- delta = -500,000
- Result: 5,000,000đ ✓

**Receive repayment 1,500,000:**
- delta = +1,500,000
- Result: 6,500,000đ ✓

**Save 1,000,000:**
- delta = 0 (not in wallet)
- Wallet: 6,500,000đ (unchanged)
- Savings: 1,000,000đ (separate)

## Database Triggers

### Insert
When you create a debt transaction → Trigger calculates delta → Updates wallet balance immediately

### Update
When you edit a debt transaction → Trigger removes old delta → Applies new delta

### Delete
When you delete a debt transaction → Trigger removes delta from wallet

## Negative Value Support

Wallets can go negative:
- Bank: -251,000đ (owed more than available)
- Properly supported by NUMERIC(18,2) column type

## Exclusions

**Savings** are NEVER included in wallet balance:
- You can have 10,000,000đ in savings
- Wallet balance remains independent
- Total assets = Wallet balance + Savings amount

## Key Files

- `20260623_add_wallet_balance_sync.sql` - Triggers & schema
- `20260624_recalculate_wallet_balances.sql` - Recalculates all balances
- Frontend reads `current_balance` directly from database

## Status

✅ Debt logic implemented
✅ Negative values supported
✅ Savings excluded correctly
✅ Triggers auto-sync balance
✅ TypeScript compiles
✅ Ready to deploy

## Deployment

1. Run: `20260623_add_wallet_balance_sync.sql`
2. Run: `20260624_recalculate_wallet_balances.sql`
3. Deploy frontend
4. Verify balances are correct
