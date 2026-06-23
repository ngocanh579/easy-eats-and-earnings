type WalletLike = {
  id: string;
  type?: string | null;
  initial_balance?: number | string | null;
  current_balance?: number | string | null;
};

type TransactionLike = {
  wallet_id: string;
  kind: "expense" | "income" | "debt" | "savings";
  amount: number | string;
};

/**
 * Bank wallets are treated as ledger-derived balances:
 * initial balance + income - expense.
 * Other wallet types keep using the stored current_balance value.
 */
export function buildWalletBalanceMap(
  wallets: WalletLike[],
  transactions: TransactionLike[] = [],
) {
  const map = new Map<string, number>();
  const bankWalletIds = new Set(
    wallets.filter((wallet) => wallet.type === "bank").map((wallet) => wallet.id),
  );

  const bankDeltas = new Map<string, { income: number; expense: number }>();
  for (const tx of transactions) {
    if (!bankWalletIds.has(tx.wallet_id)) continue;
    if (tx.kind !== "income" && tx.kind !== "expense") continue;

    const current = bankDeltas.get(tx.wallet_id) ?? { income: 0, expense: 0 };
    const amount = Number(tx.amount) || 0;

    if (tx.kind === "income") current.income += amount;
    if (tx.kind === "expense") current.expense += amount;
    bankDeltas.set(tx.wallet_id, current);
  }

  for (const wallet of wallets) {
    const initialBalance = Number(wallet.initial_balance ?? 0) || 0;
    const currentBalance = Number(wallet.current_balance ?? 0) || 0;

    if (wallet.type !== "bank") {
      map.set(wallet.id, currentBalance);
      continue;
    }

    const bankDelta = bankDeltas.get(wallet.id) ?? { income: 0, expense: 0 };
    map.set(wallet.id, initialBalance + bankDelta.income - bankDelta.expense);
  }

  return map;
}
