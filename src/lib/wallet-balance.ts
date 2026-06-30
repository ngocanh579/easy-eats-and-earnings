type WalletLike = {
  id: string;
  type?: string | null;
  initial_balance?: number | string | null;
  current_balance?: number | string | null;
};

type TransactionLike = {
  wallet_id: string;
  kind: "expense" | "income" | "debt" | "savings" | "transfer";
  amount: number | string;
  transfer_to_wallet_id?: string | null;
};

/**
 * Bank wallets are treated as ledger-derived balances:
 * initial balance + income - expense (+ transfer in) - (transfer out).
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

  const bankDeltas = new Map<string, number>();
  const addDelta = (id: string, delta: number) => {
    if (!bankWalletIds.has(id)) return;
    bankDeltas.set(id, (bankDeltas.get(id) ?? 0) + delta);
  };

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    if (tx.kind === "income") addDelta(tx.wallet_id, amount);
    else if (tx.kind === "expense") addDelta(tx.wallet_id, -amount);
    else if (tx.kind === "transfer") {
      addDelta(tx.wallet_id, -amount);
      if (tx.transfer_to_wallet_id) addDelta(tx.transfer_to_wallet_id, amount);
    }
  }

  for (const wallet of wallets) {
    const initialBalance = Number(wallet.initial_balance ?? 0) || 0;
    const currentBalance = Number(wallet.current_balance ?? 0) || 0;

    if (wallet.type !== "bank") {
      map.set(wallet.id, currentBalance);
      continue;
    }

    map.set(wallet.id, initialBalance + (bankDeltas.get(wallet.id) ?? 0));
  }

  return map;
}
