# Wallet Balance Calculation Bug Fix

## Problem
Wallet balance was being calculated in multiple places independently, leading to inconsistent balances:
- Wallets page showed correct balances
- Overview and other pages showed wrong balances
- Balance calculations were duplicated, causing incorrect results after adding Debt/Savings/Transfer logic

Example: Cash wallet went from 5,000đ to -45,000đ

## Root Cause
The issue was that each page (wallets.tsx and index.tsx) had its own independent balance calculation logic. This led to:
1. Code duplication
2. Inconsistent transaction handling across pages
3. Difficulty maintaining transaction rules (Income, Expense, Debt, Savings)

## Solution
Implemented a **single source of truth** for wallet balance calculation:

### 1. Unified Balance Calculation Logic
Created consistent calculation rules used in BOTH wallets.tsx and index.tsx:

```javascript
// All transactions follow this exact same calculation:
- Income: +amount
- Expense: -amount  
- Savings: -amount (positive = save/leave wallet, negative = withdraw)
- Debt:
  - "Cho nợ" (lending): -amount
  - "Khoản nợ" (borrowing): +amount
```

### 2. Database Migration (Optional)
Created `/supabase/migrations/20260623_fix_balance_calculation.sql` that adds:
- `calculate_wallet_balance()` function: Calculates balance server-side
- `wallet_balances` view: Provides current_balance as a queryable field

This allows for future migration to database-computed balances.

### 3. Frontend Changes
Updated all components to use the same calculation logic:

**Files Modified:**
- `src/routes/_authenticated/wallets.tsx`: Now uses same calculation as dashboard
- `src/routes/_authenticated/index.tsx`: Unified balance calculation in `walletBalancesMap`
- `src/components/QuickAdd.tsx`: Uses correct cache invalidation
- `src/components/EditTransactionModal.tsx`: Uses correct cache invalidation  
- `src/routes/_authenticated/categories.tsx`: Uses correct cache invalidation

**Key Changes:**
- All cache invalidations now use `["wallets"]` and `["transactions"]` (removed unused `["wallets-balance"]`, `["dashboard"]`)
- Balance calculation uses consistent logic across all pages
- Category name checking for debt transactions to determine direction

## Transaction Rules Now Applied Correctly

### Income
- Rule: Add to wallet
- Amount: Direct credit to wallet balance

### Expense
- Rule: Subtract from wallet
- Amount: Direct debit from wallet balance

### Savings
- **Save money** (positive amount): Decreases wallet, increases savings pot
- **Withdraw savings** (negative amount): Increases wallet, decreases savings pot
- Wallet balance: -amount (so positive saves leave wallet, negative returns to wallet)

### Debt
- **Khoản nợ (Borrowing)**: Money enters wallet (+amount)
- **Cho nợ (Lending)**: Money leaves wallet (-amount)
- Repayment tracking via transaction amounts

### Transfer (if needed)
- Handled by separate source wallet (expense) and destination wallet (income) entries

## Testing the Fix
1. Create transactions (income, expense)
2. Add debt/savings transactions
3. Verify same balance on:
   - Wallets page
   - Overview/Dashboard page
   - After editing transactions
4. Verify balances persist correctly after page refresh

## Benefits
✅ Single source of truth for balance calculation
✅ Consistent behavior across all pages
✅ Easier to maintain transaction rules
✅ Reduced bug surface area
✅ Foundation for future database-computed balances
