import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  TrendingDown,
  TrendingUp,
  Wallet,
  PiggyBank,
  Receipt,
  HandCoins,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EditTransactionModal, TransactionToEdit } from "@/components/EditTransactionModal";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

type Tx = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  kind: "expense" | "income" | "debt" | "savings";
  amount: number;
  note: string | null;
  occurred_at: string;
};

function useDashboardData() {
  const wallets = useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const txs = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,kind,icon,color,parent_id");
      if (error) throw error;
      return data;
    },
  });
  return { wallets, txs, cats };
}

function DashboardPage() {
  const { wallets, txs, cats } = useDashboardData();
  const [hidden, setHidden] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionToEdit | null>(null);
  const [selectedView, setSelectedView] = useState<{
    kind: "income" | "expense" | "debt" | "savings";
    categoryId?: string | null;
  } | null>(null);

  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Đã xoá giao dịch");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Read wallet balances directly from database (single source of truth)
  // Wallet balance is now updated by database triggers when transactions change
  const balanceByWalletId = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of wallets.data ?? []) {
      map.set(w.id, Number((w as any).current_balance ?? 0));
    }
    return map;
  }, [wallets.data]);

  // Quỹ tiết kiệm = tổng các giao dịch kind="savings" (gửi vào dương, rút ra âm)
  const savingsPot = useMemo(
    () =>
      (txs.data ?? [])
        .filter((t) => t.kind === "savings")
        .reduce((a, t) => a + Number(t.amount), 0),
    [txs.data],
  );

  const walletSum = useMemo(
    () => Array.from(balanceByWalletId.values()).reduce((a, b) => a + b, 0),
    [balanceByWalletId],
  );

  // Tổng tài sản = chỉ tính từ Ví (Tiết kiệm và Nợ được tính riêng)
  const total = walletSum;

  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = monthKey(now);

  const monthStats = useMemo(() => {
    let inc = 0,
      exp = 0,
      debt = 0,
      sav = 0;
    for (const t of txs.data ?? []) {
      if (monthKey(new Date(t.occurred_at)) !== thisMonth) continue;
      const amt = Number(t.amount);
      if (t.kind === "income") inc += amt;
      else if (t.kind === "expense") exp += amt;
      else if (t.kind === "debt") debt += amt;
      else sav += amt;
    }
    return { inc, exp, debt, sav };
  }, [txs.data, thisMonth]);

  const chartData = useMemo(() => {
    const months: { key: string; label: string; expense: number; income: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: monthKey(d),
        label: `T${d.getMonth() + 1}`,
        expense: 0,
        income: 0,
      });
    }
    const idx = new Map(months.map((m, i) => [m.key, i]));
    for (const t of txs.data ?? []) {
      const k = monthKey(new Date(t.occurred_at));
      const i = idx.get(k);
      if (i === undefined) continue;
      if (t.kind === "expense") months[i].expense += Number(t.amount);
      else if (t.kind === "income") months[i].income += Number(t.amount);
    }
    return months;
  }, [txs.data]);

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs.data ?? []) {
      if (t.kind !== "expense") continue;
      if (monthKey(new Date(t.occurred_at)) !== thisMonth) continue;
      if (!t.category_id) continue;
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + Number(t.amount));
    }
    const catMap = new Map((cats.data ?? []).map((c) => [c.id, c]));
    return Array.from(map.entries())
      .map(([id, amt]) => ({ cat: catMap.get(id), amount: amt }))
      .filter((x) => x.cat)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [txs.data, cats.data, thisMonth]);

  const noSpendDays = useMemo(() => {
    const today = new Date();
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dayKey = d.toISOString().slice(0, 10);
      const has = (txs.data ?? []).some(
        (t) => t.kind === "expense" && t.occurred_at.slice(0, 10) === dayKey,
      );
      if (!has) count++;
    }
    return count;
  }, [txs.data]);

  const recent = (txs.data ?? []).slice(0, 8);

  const mask = (v: string) => (hidden ? "••••••" : v);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Tổng tài sản</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight lg:text-5xl">
              {mask(formatVND(total))}
            </h1>
            <button
              onClick={() => setHidden((h) => !h)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Ẩn/hiện số dư"
            >
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Thu tháng này"
          value={mask(formatVND(monthStats.inc))}
          icon={<ArrowDownRight className="h-4 w-4" />}
          tone="success"
          onClick={() => setSelectedView({ kind: "income" })}
        />
        <StatCard
          label="Chi tháng này"
          value={mask(formatVND(monthStats.exp))}
          icon={<ArrowUpRight className="h-4 w-4" />}
          tone="destructive"
          onClick={() => setSelectedView({ kind: "expense" })}
        />
        <StatCard
          label="Nợ"
          value={mask(formatVND(monthStats.debt))}
          icon={<HandCoins className="h-4 w-4" />}
          tone="warning"
          onClick={() => setSelectedView({ kind: "debt" })}
        />
        <StatCard
          label="Tiết kiệm"
          value={mask(formatVND(monthStats.sav))}
          icon={<PiggyBank className="h-4 w-4" />}
          tone="primary"
          onClick={() => setSelectedView({ kind: "savings" })}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Chart */}
        <div className="rounded-2xl border border-border bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-soft)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Chi tiêu 6 tháng gần nhất</h3>
              <p className="text-xs text-muted-foreground">Quan sát xu hướng theo tháng</p>
            </div>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}tr`
                      : v >= 1000
                        ? `${v / 1000}k`
                        : `${v}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatVND(v)}
                />
                <Bar dataKey="income" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insights */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Ngày không chi tiêu
            </div>
            <p className="mt-2 font-display text-3xl font-semibold">
              {noSpendDays}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ 30 ngày</span>
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Receipt className="h-4 w-4" /> Top chi tiêu tháng này
            </div>
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
            ) : (
              <ul className="space-y-2">
                {topCategories.map(({ cat, amount }) => (
                  <li key={cat!.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <span>{cat!.icon}</span>
                      <span className="truncate">{cat!.name}</span>
                    </span>
                    <span className="font-display font-semibold">{mask(formatVND(amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Wallets */}
      <div>
        <h3 className="mb-3 font-display text-base font-semibold">Ví của bạn</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(wallets.data ?? []).map((w) => (
            <div
              key={w.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{w.icon ?? "💼"}</span>
                <span className="truncate">{w.name}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold">
                {mask(formatVND(balanceByWalletId.get(w.id) ?? 0))}
              </p>
            </div>
          ))}
          {(wallets.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có ví — vào tab Ví để tạo.</p>
          )}
        </div>
      </div>

      {/* Recent */}
      <div>
        <h3 className="mb-3 font-display text-base font-semibold">Giao dịch gần đây</h3>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          {recent.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Wallet className="mx-auto mb-2 h-6 w-6 opacity-40" />
              Chưa có giao dịch. Bấm nút <strong>+</strong> để thêm nhanh.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((t) => {
                const cat = (cats.data ?? []).find((c) => c.id === t.category_id);
                const w = (wallets.data ?? []).find((x) => x.id === t.wallet_id);
                const sign = t.kind === "income" ? "+" : t.kind === "expense" ? "-" : "";
                return (
                  <li
                    key={t.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-accent/50"
                    onClick={() => setEditingTx(t)}
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-lg">
                      {cat?.icon ?? "💸"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t.note || cat?.name || "Giao dịch"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {w?.name} • {new Date(t.occurred_at).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "font-display text-sm font-semibold mr-1",
                        t.kind === "income" && "text-success",
                        t.kind === "expense" && "text-destructive",
                      )}
                    >
                      {sign}
                      {mask(formatVND(Number(t.amount)))}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTx(t);
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Sửa giao dịch"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Bạn có chắc chắn muốn xoá giao dịch này?")) {
                            del.mutate(t.id);
                          }
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Xoá giao dịch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {selectedView &&
        (() => {
          const kind = selectedView.kind;
          const allCats = cats.data ?? [];
          const parent = allCats.find((c) => c.kind === kind && c.parent_id === null);
          const children = parent ? allCats.filter((c) => c.parent_id === parent.id) : [];
          const hasChildren = children.length > 0;
          const activeCatId = selectedView.categoryId;

          const allTxs = txs.data ?? [];
          const kindTxs = allTxs.filter((t) => t.kind === kind);
          const filteredTxs =
            activeCatId === undefined || activeCatId === null
              ? kindTxs
              : kindTxs.filter((t) => t.category_id === activeCatId);

          const sumOf = (catId: string | null) =>
            (catId === null ? kindTxs : kindTxs.filter((t) => t.category_id === catId)).reduce(
              (a, t) => a + Number(t.amount),
              0,
            );

          const totalAll = sumOf(null);

          const header =
            kind === "debt"
              ? { icon: <HandCoins className="h-5 w-5 text-warning" />, label: "Nợ" }
              : kind === "savings"
                ? { icon: <PiggyBank className="h-5 w-5 text-primary" />, label: "Tiết kiệm" }
                : kind === "income"
                  ? { icon: <ArrowDownRight className="h-5 w-5 text-success" />, label: "Thu nhập" }
                  : {
                      icon: <ArrowUpRight className="h-5 w-5 text-destructive" />,
                      label: "Chi tiêu",
                    };

          return (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={() => setSelectedView(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-t-3xl bg-card p-5 shadow-[var(--shadow-soft)] sm:rounded-3xl max-h-[85vh] flex flex-col"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                    {header.icon}
                    <span>Lịch sử giao dịch {header.label}</span>
                  </h3>
                  <button
                    onClick={() => setSelectedView(null)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {hasChildren && (
                  <>
                    <div className="mb-3 rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Tổng {header.label}</p>
                      <p className="font-display text-xl font-semibold">
                        {mask(formatVND(totalAll))}
                      </p>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSelectedView({ kind, categoryId: null })}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                          !activeCatId
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-accent",
                        )}
                      >
                        Tất cả · {mask(formatVND(totalAll))}
                      </button>
                      {children.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedView({ kind, categoryId: c.id })}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                            activeCatId === c.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-accent",
                          )}
                        >
                          {c.icon} {c.name} · {mask(formatVND(sumOf(c.id)))}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
                  {filteredTxs.length === 0 ? (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                      Chưa có giao dịch nào thuộc nhóm này.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filteredTxs.map((t) => {
                        const cat = allCats.find((c) => c.id === t.category_id);
                        const w = (wallets.data ?? []).find((x) => x.id === t.wallet_id);
                        return (
                          <li
                            key={t.id}
                            className="flex items-center gap-3 py-3 hover:bg-accent/30 rounded-lg px-2"
                          >
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-lg">
                              {cat?.icon ?? "🏷️"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {t.note || cat?.name || "Giao dịch"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {w?.name} • {new Date(t.occurred_at).toLocaleDateString("vi-VN")}
                              </p>
                            </div>
                            <div className="font-display text-sm font-semibold text-foreground mr-2">
                              {mask(formatVND(Number(t.amount)))}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingTx(t as TransactionToEdit)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                aria-label="Sửa giao dịch"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm("Bạn có chắc chắn muốn xoá giao dịch này?")) {
                                    del.mutate(t.id);
                                  }
                                }}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Xoá giao dịch"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      <EditTransactionModal
        transaction={editingTx}
        open={!!editingTx}
        onClose={() => setEditingTx(null)}
        wallets={wallets.data ?? []}
        categories={cats.data ?? []}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "success" | "destructive" | "warning" | "primary";
  onClick?: () => void;
}) {
  const toneClass = {
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
    primary: "bg-primary/10 text-primary",
  }[tone];
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-all duration-200",
        onClick &&
          "cursor-pointer hover:scale-[1.02] hover:border-primary/40 hover:shadow-[var(--shadow-glow)] active:scale-[0.98]",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", toneClass)}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-lg font-semibold lg:text-xl">{value}</p>
    </div>
  );
}
