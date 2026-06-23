# Debt Transaction & Wallet Balance Integration Guide

## Overview

Debt transactions represent real cash flow in and out of your wallet. Unlike savings which are tracked separately, debt directly affects your available wallet balance.

## Complete Wallet Balance Formula

```
current_balance = initial_balance + income - expense + debt_cash_flow
```

### Components:
- **income**: Money received (+amount to wallet)
- **expense**: Money spent (-amount from wallet)
- **debt_cash_flow**: Money borrowed/lent/repaid (varies by type)
- **savings**: EXCLUDED (separate from wallet balance)

## Debt Transaction Types & Cash Flow

### 1. Borrowing Money (Khoản nợ - Default)
**Scenario**: You borrow 1,000,000đ from a friend

| Field | Value |
|-------|-------|
| kind | debt |
| amount | 1,000,000 |
| category | Khoản nợ (or any non-"Cho nợ" category) |
| **Cash Flow** | **+1,000,000** (money enters wallet) |

**Result**: Wallet increases because you received borrowed money

---

### 2. Lending Money (Cho nợ)
**Scenario**: You lend 500,000đ to a friend

| Field | Value |
|-------|-------|
| kind | debt |
| amount | 500,000 |
| category | Cho nợ |
| **Cash Flow** | **-500,000** (money leaves wallet) |

**Result**: Wallet decreases because you gave money away

---

### 3. Receiving Debt Repayment (Khoản nợ)
**Scenario**: Friend repays 1,000,000đ you lent earlier

| Field | Value |
|-------|-------|
| kind | debt |
| amount | 1,000,000 |
| category | Khoản nợ (represents receiving payment) |
| **Cash Flow** | **+1,000,000** (money enters wallet) |

**Result**: Wallet increases because you received repayment

---

### 4. Repaying Debt (Khoản nợ with negative amount)
**Scenario**: You repay 800,000đ debt

| Field | Value |
|-------|-------|
| kind | debt |
| amount | -800,000 |
| category | Khoản nợ |
| **Cash Flow** | **-800,000** (negative amount = money leaves) |

**Result**: Wallet decreases because you paid back money

---

## Logic Implementation

### Database Trigger Logic

```sql
CASE
  WHEN kind = 'debt' AND category = 'Cho nợ' THEN -amount   -- Lending
  WHEN kind = 'debt' AND category != 'Cho nợ' THEN amount   -- Borrowing/Repayment
  WHEN kind = 'income' THEN amount
  WHEN kind = 'expense' THEN -amount
  WHEN kind = 'savings' THEN 0
END
```

### Key Rules

1. **Lending (Cho nợ)**: Always decreases wallet balance
   - Formula: `delta = -amount`
   - Reason: Money left your wallet

2. **Borrowing/Repayment**: Uses amount as-is
   - Positive amount: +cash_flow (money coming in)
   - Negative amount: -cash_flow (money going out)
   - Category must NOT be "Cho nợ"

3. **Savings**: Always 0 cash flow
   - Never affects wallet balance
   - Tracked separately for total assets

## Real-World Example

**Initial Bank Balance**: 5,000,000đ

### Transaction 1: Borrow money
- Type: Debt (Khoản nợ)
- Amount: 2,000,000đ
- Cash flow: +2,000,000
- New balance: 7,000,000đ

### Transaction 2: Lend money
- Type: Debt (Cho nợ)
- Amount: 1,500,000đ
- Cash flow: -1,500,000
- New balance: 5,500,000đ

### Transaction 3: Expense
- Type: Expense
- Amount: 500,000đ
- Cash flow: -500,000
- New balance: 5,000,000đ

### Transaction 4: Receive repayment
- Type: Debt (Khoản nợ)
- Amount: 1,500,000đ
- Cash flow: +1,500,000
- New balance: 6,500,000đ

### Transaction 5: Income
- Type: Income
- Amount: 1,000,000đ
- Cash flow: +1,000,000
- New balance: 7,500,000đ

### Transaction 6: Save money
- Type: Savings
- Amount: 1,000,000đ
- Cash flow: 0 (NOT affected)
- Wallet balance: 7,500,000đ (unchanged)
- Savings pot: 1,000,000đ (tracked separately)

## Migration Guarantees

### What the Migrations Do

1. **20260623_add_wallet_balance_sync.sql**
   - Adds `current_balance` column to wallets
   - Creates 3 trigger functions for insert/update/delete
   - Triggers implement full debt logic with category checking
   - Only fires for income, expense, and debt (NOT savings)

2. **20260624_recalculate_wallet_balances.sql**
   - Recalculates all existing wallet balances
   - Uses complete formula: `initial_balance + sum(income - expense + debt_effect)`
   - Joins transactions and categories tables
   - Handles all transaction types correctly

### What Triggers Maintain

- **On INSERT transaction**: Calculates delta, updates wallet immediately
- **On UPDATE transaction**: Removes old delta, applies new delta
- **On DELETE transaction**: Removes delta from wallet
- **On wallet_id change**: Transfers delta between wallets

### What Does NOT Affect Wallet Balance

- Savings transactions (kind='savings') → Always 0 delta
- Transfers between wallets (future feature)
- Budget allocations
- Investment tracking

## Testing & Verification

### Test Cases

1. **Borrowing increases balance**
   - Create debt transaction (Khoản nợ, amount=100,000)
   - Verify wallet balance increased by 100,000

2. **Lending decreases balance**
   - Create debt transaction (Cho nợ, amount=100,000)
   - Verify wallet balance decreased by 100,000

3. **Savings don't affect wallet**
   - Create savings transaction (amount=100,000)
   - Verify wallet balance unchanged
   - Verify savings pot increased

4. **Negative amounts work**
   - Create debt transaction (Khoản nợ, amount=-50,000)
   - Verify wallet balance decreased by 50,000

### Verification Query

```sql
SELECT 
  w.name,
  w.initial_balance,
  w.current_balance,
  w.current_balance - w.initial_balance as total_transaction_delta
FROM wallets w
ORDER BY w.created_at;
```

## Deployment Checklist

- [ ] Run migration: `20260623_add_wallet_balance_sync.sql`
- [ ] Run migration: `20260624_recalculate_wallet_balances.sql`
- [ ] Verify wallet balances are not 0
- [ ] Test borrowing transaction
- [ ] Test lending transaction
- [ ] Test savings transaction (verify wallet unchanged)
- [ ] Verify Overview and Wallets page show same balance
- [ ] Verify Total Assets = Wallet Sum + Savings
- [ ] Deploy frontend code

## Troubleshooting

### Wallet balance shows 0

**Cause**: Migration didn't run or ran partially
**Solution**: 
1. Check if `current_balance` column exists: `SELECT * FROM information_schema.columns WHERE table_name='wallets';`
2. If missing, run migration 20260623
3. Run recalculation migration 20260624

### Debt transactions don't update balance

**Cause**: Trigger function failed or trigger not created
**Solution**:
```sql
SELECT * FROM information_schema.triggers WHERE event_object_table='transactions';
```
Verify all 3 triggers exist and are enabled.

### Savings affecting total assets incorrectly

**Cause**: Savings transactions may be included in wallet balance
**Solution**: Run recalculation migration to fix

---

**Status**: Ready for production deployment
**Last Updated**: 2024-06-23
