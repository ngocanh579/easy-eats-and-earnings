import { useMemo, useState, useEffect } from "react";
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .order("created_at");
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
        .select("id,name,kind,icon,color");
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
  const [selectedKindForView, setSelectedKindForView] = useState<"income" | "expense" | "debt" | "savings" | null>(null);
  const [selectedCategoryForView, setSelectedCategoryForView] = useState<string | null>(null);

  const qc = useQueryClient();

  useEffect(() => {
    async function migrate() {
      if (localStorage.getItem("migration_v3_completed") === "true") return;

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const uid = u.user.id;

      const { data: existingCats } = await supabase.from("categories").select("*");
      if (!existingCats) return;

      const groups = [
        { name: "Khoản nợ", kind: "debt", icon: "📥", parent_id: null },
        { name: "Cho nợ", kind: "debt", icon: "📤", parent_id: null },
        { name: "Tiết kiệm hộ", kind: "savings", icon: "🤝", parent_id: null },
        { name: "Khoản tiết kiệm đồ muốn mua", kind: "savings", icon: "🛍️", parent_id: null },
        { name: "Dự phòng", kind: "savings", icon: "🛡️", parent_id: null },
      ];

      let catsRef = [...existingCats];
      let didInsert = false;

      for (const g of groups) {
        if (!catsRef.find((c) => c.name === g.name && c.kind === g.kind && !c.parent_id)) {
          const { data } = await supabase.from("categories").insert({ ...g, user_id: uid }).select("*").single();
          if (data) {
            catsRef.push(data);
            didInsert = true;
          }
        }
      }

      const getParentId = (name: string, kind: string) => catsRef.find((c) => c.name === name && c.kind === kind && !c.parent_id)?.id;

      const details = [
        { name: "Nợ ngân hàng", kind: "debt", icon: "🏦", parent_id: getParentId("Khoản nợ", "debt") },
        { name: "Nợ bạn bè", kind: "debt", icon: "👥", parent_id: getParentId("Khoản nợ", "debt") },
        { name: "Cho người khác vay", kind: "debt", icon: "💸", parent_id: getParentId("Cho nợ", "debt") },
        { name: "Tiền giữ hộ", kind: "savings", icon: "💼", parent_id: getParentId("Tiết kiệm hộ", "savings") },
        { name: "Điện thoại", kind: "savings", icon: "📱", parent_id: getParentId("Khoản tiết kiệm đồ muốn mua", "savings") },
        { name: "Laptop", kind: "savings", icon: "💻", parent_id: getParentId("Khoản tiết kiệm đồ muốn mua", "savings") },
        { name: "Xe", kind: "savings", icon: "🚗", parent_id: getParentId("Khoản tiết kiệm đồ muốn mua", "savings") },
        { name: "Quỹ khẩn cấp", kind: "savings", icon: "🚑", parent_id: getParentId("Dự phòng", "savings") },
      ];

      for (const d of details) {
        if (d.parent_id && !catsRef.find((c) => c.name === d.name && c.kind === d.kind && c.parent_id === d.parent_id)) {
          const { data } = await supabase.from("categories").insert({ ...d, user_id: uid }).select("*").single();
          if (data) {
            catsRef.push(data);
            didInsert = true;
          }
        }
      }

      let migrated = false;
      const defDebt = catsRef.find((c) => c.name === "Nợ ngân hàng" && c.kind === "debt")?.id;
      const defSav = catsRef.find((c) => c.name === "Quỹ khẩn cấp" && c.kind === "savings")?.id;

      if (defDebt) {
        const { data } = await supabase.from("transactions").update({ category_id: defDebt }).eq("kind", "debt").is("category_id", null).select("id");
        if (data && data.length > 0) migrated = true;
      }
      if (defSav) {
        const { data } = await supabase.from("transactions").update({ category_id: defSav }).eq("kind", "savings").is("category_id", null).select("id");
        if (data && data.length > 0) migrated = true;
      }

      if (didInsert) qc.invalidateQueries({ queryKey: ["categories"] });
      if (migrated) qc.invalidateQueries({ queryKey: ["transactions"] });

      localStorage.setItem("migration_v3_completed", "true");
    }
    migrate();
  }, [qc]);
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["wallets-balance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Đã xoá giao dịch");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const walletBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of wallets.data ?? []) {
      map.set(w.id, Number(w.initial_balance));
    }
    for (const t of txs.data ?? []) {
      const cur = map.get(t.wallet_id) ?? 0;
      const sign =
        t.kind === "income" ? 1 : t.kind === "expense" ? -1 : 0; // debt/savings: neutral on cash
      map.set(t.wallet_id, cur + sign * Number(t.amount));
    }
    return map;
  }, [wallets.data, txs.data]);

  const total = useMemo(
    () => Array.from(walletBalances.values()).reduce((a, b) => a + b, 0),
    [walletBalances],
  );

  const now = new Date();
  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = monthKey(now);

  const monthStats = useMemo(() => {
    let inc = 0,
      exp = 0;
    for (const t of txs.data ?? []) {
      if (monthKey(new Date(t.occurred_at)) !== thisMonth) continue;
      const amt = Number(t.amount);
      if (t.kind === "income") inc += amt;
      else if (t.kind === "expense") exp += amt;
    }
    return { inc, exp };
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
        (t) =>
          t.kind === "expense" && t.occurred_at.slice(0, 10) === dayKey,
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
          onClick={() => setSelectedKindForView("income")}
        />
        <StatCard
          label="Chi tháng này"
          value={mask(formatVND(monthStats.exp))}
          icon={<ArrowUpRight className="h-4 w-4" />}
          tone="destructive"
          onClick={() => setSelectedKindForView("expense")}
        />
        <NestedStatCard
          label="Nợ"
          icon={<HandCoins className="h-4 w-4" />}
          tone="warning"
          mask={mask}
          kind="debt"
          txs={txs.data ?? []}
          cats={cats.data ?? []}
          onSelect={(catId) => {
            setSelectedKindForView("debt");
            setSelectedCategoryForView(catId || null);
          }}
        />
        <NestedStatCard
          label="Tiết kiệm"
          icon={<PiggyBank className="h-4 w-4" />}
          tone="primary"
          mask={mask}
          kind="savings"
          txs={txs.data ?? []}
          cats={cats.data ?? []}
          onSelect={(catId) => {
            setSelectedKindForView("savings");
            setSelectedCategoryForView(catId || null);
          }}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Chart */}
        <div className="rounded-2xl border border-border bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-soft)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">
                Chi tiêu 6 tháng gần nhất
              </h3>
              <p className="text-xs text-muted-foreground">
                Quan sát xu hướng theo tháng
              </p>
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
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / 30 ngày
              </span>
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
                    <span className="font-display font-semibold">
                      {mask(formatVND(amount))}
                    </span>
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
                {mask(formatVND(walletBalances.get(w.id) ?? 0))}
              </p>
            </div>
          ))}
          {(wallets.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Chưa có ví — vào tab Ví để tạo.
            </p>
          )}
        </div>
      </div>

      {/* Recent */}
      <div>
        <h3 className="mb-3 font-display text-base font-semibold">
          Giao dịch gần đây
        </h3>
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
                const sign =
                  t.kind === "income"
                    ? "+"
                    : t.kind === "expense"
                      ? "-"
                      : "";
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
                        {w?.name} •{" "}
                        {new Date(t.occurred_at).toLocaleDateString("vi-VN")}
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

      {selectedKindForView && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => {
            setSelectedKindForView(null);
            setSelectedCategoryForView(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-card p-5 shadow-[var(--shadow-soft)] sm:rounded-3xl max-h-[85vh] flex flex-col"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                {selectedCategoryForView ? (
                  <>
                    <span className="text-xl">
                      {(cats.data ?? []).find((c) => c.id === selectedCategoryForView)?.icon ?? "🏷️"}
                    </span>
                    <span>
                      Lịch sử {(cats.data ?? []).find((c) => c.id === selectedCategoryForView)?.name}
                    </span>
                  </>
                ) : (
                  <>
                    {selectedKindForView === "debt" && (
                      <>
                        <HandCoins className="h-5 w-5 text-warning" />
                        <span>Lịch sử giao dịch Nợ</span>
                      </>
                    )}
                    {selectedKindForView === "savings" && (
                      <>
                        <PiggyBank className="h-5 w-5 text-primary" />
                        <span>Lịch sử giao dịch Tiết kiệm</span>
                      </>
                    )}
                    {selectedKindForView === "income" && (
                      <>
                        <ArrowDownRight className="h-5 w-5 text-success" />
                        <span>Lịch sử giao dịch Thu nhập</span>
                      </>
                    )}
                    {selectedKindForView === "expense" && (
                      <>
                        <ArrowUpRight className="h-5 w-5 text-destructive" />
                        <span>Lịch sử giao dịch Chi tiêu</span>
                      </>
                    )}
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  setSelectedKindForView(null);
                           <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
              {(() => {
                const filteredTxs = (txs.data ?? []).filter((t) => {
                  if (t.kind !== selectedKindForView) return false;
                  if (!selectedCategoryForView) return true;
                  
                  // if a specific category is selected, check if tx is in that category OR any of its children
                  if (t.category_id === selectedCategoryForView) return true;
                  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c]));
                  const txCat = catMap.get(t.category_id || "");
                  if (txCat && txCat.parent_id === selectedCategoryForView) return true;
                  return false;
                });

                if (filteredTxs.length === 0) {
                  return (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                      Chưa có giao dịch nào thuộc loại này.
                    </p>
                  );
                }

                return (
                  <ul className="divide-y divide-border">
                    {filteredTxs.map((t) => {
                      const cat = (cats.data ?? []).find((c) => c.id === t.category_id);
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
                              {w?.name} •{" "}
                              {new Date(t.occurred_at).toLocaleDateString("vi-VN")}
                            </p>
                          </div>
                          <div className="font-display text-sm font-semibold text-foreground mr-2">
                            {formatVND(Number(t.amount))}
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
                );
              })()}
            </div>       >
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
      )}

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
        onClick && "cursor-pointer hover:scale-[1.02] hover:border-primary/40 hover:shadow-[var(--shadow-glow)] active:scale-[0.98]"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", toneClass)}>
          {icon}
        </span>
      </div>
      <p className="mt-2 font-display text-lg font-semibold lg:text-xl">{value}</p>
    </div>
  );
}

function NestedStatCard({
  label,
  icon,
  tone,
  mask,
  kind,
  txs,
  cats,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "warning" | "primary";
  mask: (v: string) => string;
  kind: string;
  txs: any[];
  cats: any[];
  onSelect: (catId?: string) => void;
}) {
  const toneClass = tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary";
  
  const kindTxs = txs.filter((t) => t.kind === kind);
  const total = kindTxs.reduce((sum, t) => sum + Number(t.amount), 0);

  const groups = cats.filter((c) => c.kind === kind && !c.parent_id).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const catMap = new Map(cats.map(c => [c.id, c]));

  const getCatTotal = (catId: string) => {
    return kindTxs
      .filter((t) => t.category_id === catId || catMap.get(t.category_id || "")?.parent_id === catId)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-all duration-200 col-span-2">
      <div
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => onSelect()}
      >
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", toneClass)}>
          {icon}
        </span>
      </div>
      <p
        className="mt-2 font-display text-lg font-semibold lg:text-xl cursor-pointer hover:opacity-80"
        onClick={() => onSelect()}
      >
        {mask(formatVND(total))}
      </p>

      {groups.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
          {groups.map((g) => {
            const groupTotal = getCatTotal(g.id);
            const details = cats.filter((c) => c.parent_id === g.id).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

            return (
              <div key={g.id} className="flex flex-col gap-1">
                <div
                  className="flex items-center justify-between text-sm cursor-pointer hover:bg-accent/50 p-1.5 -mx-1.5 rounded-lg transition-colors font-medium text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(g.id);
                  }}
                >
                  <span className="truncate mr-2" title={g.name}>
                    {g.icon} {g.name}
                  </span>
                  <span>{mask(formatVND(groupTotal))}</span>
                </div>
                {details.length > 0 && (
                  <div className="flex flex-col pl-6 space-y-0.5 border-l-2 border-border/50 ml-1.5 mt-0.5">
                    {details.map((d) => {
                      const detailTotal = getCatTotal(d.id);
                      if (detailTotal === 0) return null; // hide empty details to save space
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between text-xs cursor-pointer hover:bg-accent/50 p-1 -mx-1 rounded-md transition-colors text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(d.id);
                          }}
                        >
                          <span className="truncate mr-2" title={d.name}>
                            {d.icon} {d.name}
                          </span>
                          <span>{mask(formatVND(detailTotal))}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
