# Quick Start: Wallet Balance Fix

## If Your Balances Are 0 (Data Lost)

### Step 1: Restore Balances
Run this SQL in your Supabase console (SQL Editor):

```sql
UPDATE public.wallets 
SET current_balance = initial_balance;
```

Verify it worked:
```sql
SELECT id, name, initial_balance, current_balance 
FROM public.wallets;
```

You should see:
- Bank: initial_balance = -251,000 → current_balance = -251,000 ✅
- Cash: initial_balance = X → current_balance = X ✅

### Step 2: Deploy
The code changes are already in place. Just deploy the frontend.

### Step 3: Test
1. Create a transaction (e.g., 100,000đ expense)
2. Check Wallets page - balance should update
3. Check Overview/Dashboard - balance should match
4. Both should show the same value ✅

---

## If Starting Fresh (No Data Loss Yet)

Just run the migration and deploy:
1. Migration: `20260623_add_wallet_balance_sync.sql`
2. Deploy frontend code
3. Test transactions

---

## How It Works

```
Transaction Created
  ↓
Database Trigger Updates wallet.current_balance
  ↓
Frontend Sees New Value
  ↓
All Pages Show Same Balance ✅
```

---

## Important Notes

- ✅ Negative balances work (-251,000đ is valid)
- ✅ Initial balance is preserved, not recalculated
- ✅ Each transaction updates balance once (via trigger)
- ✅ All pages read from same database field
- ✅ Transaction history is never deleted

---

## Troubleshooting

**Q: Balances still show 0**
- Run the recovery SQL above
- Check that `initial_balance` values are not 0
- Verify the migration ran successfully

**Q: Balances don't match between pages**
- Clear browser cache
- Refresh the page
- Check that both queries are reading `current_balance`

**Q: New transactions don't update balance**
- Check that triggers exist in Supabase
- Verify the transaction was actually inserted
- Check the wallets table was updated

---

## Contact Support
For issues, refer to `WALLET_BALANCE_RECOVERY.md` for detailed debugging steps.
