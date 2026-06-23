# Category Loading Fix - Quick Add & Edit Transaction Modals

## Issues Fixed

### 1. Category Not Loading Correctly for Debt & Savings
**Problem**: When selecting type = "Nợ" or "Tiết kiệm", category dropdown shows "Không danh mục" or wrong values.

**Root Cause**: 
- Debt and Savings have parent categories (aggregate-only) and child categories (actual transactions)
- Code needed to filter by `parent_id !== null` for these types
- QuickAdd was not properly filtering categories on render

**Solution Implemented**:
```javascript
// Filter categories based on kind
const filteredCats = categories.filter((c) => {
  if (c.kind !== kind) return false;
  // For debt/savings: only show child categories (parents are aggregate-only)
  if (kind === "debt" || kind === "savings") {
    return c.parent_id !== null;
  }
  return true;
});
```

### 2. Category Dropdown Sync Issue in Edit Modal
**Problem**: Edit screen shows correct UI but category options not consistent with selected type.

**Root Cause**:
- `filteredCats` was a simple filter without memoization
- When loading a transaction, the category might not match the current kind
- No validation that saved category is still valid for current kind

**Solution Implemented**:
```javascript
// Use useMemo to ensure filteredCats updates when kind or categories change
const filteredCats = useMemo(() => {
  return categories.filter((c) => {
    if (c.kind !== kind) return false;
    if (kind === "debt" || kind === "savings") {
      return c.parent_id !== null;
    }
    return true;
  });
}, [kind, categories]);

// Validate category on load
useEffect(() => {
  if (transaction && open) {
    // ... other state updates ...
    
    // Check if saved category is valid for current kind
    if (transaction.category_id) {
      const categoryValid = categories.some(
        c => c.id === transaction.category_id && c.kind === transaction.kind
      );
      setCategoryId(categoryValid ? transaction.category_id : "");
    } else {
      setCategoryId("");
    }
  }
}, [transaction, open, categories]);
```

### 3. Consistent Data Flow
**Improvements**:
- Transaction kind is the single source of truth
- Category list re-renders immediately when kind changes
- Category dropdown shows red border for required fields (debt/savings)
- Placeholder text changes based on availability:
  - "Chọn danh mục" when categories exist
  - "Không có danh mục" when none exist

**Code Changes**:
```javascript
// Improved category dropdown with visual feedback
<select
  value={categoryId}
  onChange={(e) => setCategoryId(e.target.value)}
  className={cn(
    "rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
    (kind === "debt" || kind === "savings") && !categoryId ? "border-red-500" : "border-input"
  )}
>
  <option value="">
    {filteredCats.length === 0 ? "Không có danh mục" : "Chọn danh mục"}
  </option>
  {filteredCats.map((c) => (
    <option key={c.id} value={c.id}>
      {c.icon} {c.name}
    </option>
  ))}
</select>
```

## Files Modified

1. **`src/components/QuickAdd.tsx`**
   - Added clear comments for category filtering logic
   - Improved category dropdown display
   - Added red border indication for required fields

2. **`src/components/EditTransactionModal.tsx`**
   - Added category validation on transaction load
   - Memoized `filteredCats` for performance
   - Improved category dropdown display with conditional styling
   - Fixed TypeScript null handling for category_id

## Category Structure

```
Categories Table:
├── parent_id = NULL (Aggregate categories - for display only)
│   ├── Income (kind='income')
│   ├── Expense (kind='expense')
│   ├── Nợ (kind='debt')
│   └── Tiết kiệm (kind='savings')
│
└── parent_id = [parent_id] (Transaction categories - for actual transactions)
    ├── For Debt:
    │   ├── Khoản nợ (borrowed)
    │   └── Cho nợ (lent)
    ├── For Savings:
    │   ├── Tiết kiệm hộ
    │   ├── Khoản tiết kiệm đồ muốn mua
    │   └── Dự phòng
    └── For Income/Expense: Various custom categories
```

## Behavior After Fix

### Quick Add Modal
1. User selects transaction type (Chi tiêu, Thu nhập, Nợ, Tiết kiệm)
2. Category dropdown filters immediately
3. For Debt/Savings: shows only child categories
4. For Income/Expense: shows all categories of that type
5. Red border appears on category field for Debt/Savings if not selected

### Edit Transaction Modal
1. Transaction loads with correct type
2. Category field loads with saved value (if valid)
3. If saved category doesn't match current kind, category field resets
4. Changing type resets category field
5. Category dropdown filters based on new type

## Testing Checklist

- [ ] Create Income transaction - category dropdown works
- [ ] Create Expense transaction - category dropdown works
- [ ] Create Debt transaction - shows only Khoản nợ and Cho nợ
- [ ] Create Savings transaction - shows only Tiết kiệm categories
- [ ] Edit transaction - category preserved if valid
- [ ] Edit transaction - change type, category resets
- [ ] Switch between types - category dropdown updates immediately
- [ ] Red border appears for required category fields

## TypeScript Status
✅ All TypeScript errors resolved
✅ Null handling for optional category_id
✅ Proper type inference for filtered categories
