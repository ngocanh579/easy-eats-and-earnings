import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Filter, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EditTransactionModal, TransactionToEdit } from "@/components/EditTransactionModal";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type TimeRange = "day" | "month" | "year";

function TransactionsPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<TimeRange>("month");
  const [walletFilter, setWalletFilter] = useState<string>("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [editingTx, setEditingTx] = useState<TransactionToEdit | null>(null);
  const [visibleGroups, setVisibleGroups] = useState(5);

  const wallets = useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("id,name,icon");
      if (error) throw error;
      return data;
    },
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,icon,kind");
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
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const arr = (txs.data ?? []).filter((t) => {
      if (walletFilter && t.wallet_id !== walletFilter) return false;
      if (catFilter && t.category_id !== catFilter) return false;
      return true;
    });

    const groups = new Map<string, typeof arr>();
    for (const t of arr) {
      const d = new Date(t.occurred_at);
      const key =
        range === "day"
          ? d.toISOString().slice(0, 10)
          : range === "month"
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
            : `${d.getFullYear()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return Array.from(groups.entries()).map(([key, items]) => {
      const inc = items
        .filter((t) => t.kind === "income")
        .reduce((s, t) => s + Number(t.amount), 0);
      const exp = items
        .filter((t) => t.kind === "expense")
        .reduce((s, t) => s + Number(t.amount), 0);
      return { key, items, inc, exp };
    });
  }, [txs.data, range, walletFilter, catFilter]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Đã xoá");
    },
  });

  const formatGroupLabel = (key: string) => {
    if (range === "day") return new Date(key).toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (range === "month") {
      const [y, m] = key.split("-");
      return `Tháng ${Number(m)}/${y}`;
    }
    return `Năm ${key}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold lg:text-3xl">
          Giao dịch
        </h1>
        <p className="text-sm text-muted-foreground">
          Xem theo ngày, tháng, năm. Lọc theo ví hoặc danh mục.
        </p>
      </div>

      <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0 sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0 rounded-xl border border-border bg-card p-1">
          {(["day", "month", "year"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "day" ? "Ngày" : r === "month" ? "Tháng" : "Năm"}
            </button>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
        </div>
        <select
          value={walletFilter}
          onChange={(e) => setWalletFilter(e.target.value)}
          className="shrink-0 max-w-[45vw] rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Mọi ví</option>
          {(wallets.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.icon} {w.name}
            </option>
          ))}
        </select>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="shrink-0 max-w-[45vw] rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Mọi danh mục</option>
          {(cats.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Không có giao dịch.
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((g) => (
          <div
            key={g.key}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-medium capitalize">
                {formatGroupLabel(g.key)}
              </p>
              <div className="flex gap-3 text-xs">
                <span className="text-success">+{formatVND(g.inc)}</span>
                <span className="text-destructive">-{formatVND(g.exp)}</span>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {g.items.map((t) => {
                const cat = (cats.data ?? []).find((c) => c.id === t.category_id);
                const w = (wallets.data ?? []).find((x) => x.id === t.wallet_id);
                const sign = t.kind === "income" ? "+" : t.kind === "expense" ? "-" : "";
                return (
                  <li
                    key={t.id}
                    className="group flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-accent/50"
                    onClick={() => setEditingTx(t as TransactionToEdit)}
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
                        {new Date(t.occurred_at).toLocaleString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
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
                      {formatVND(Number(t.amount))}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTx(t as TransactionToEdit);
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
          </div>
        ))}
      </div>

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
