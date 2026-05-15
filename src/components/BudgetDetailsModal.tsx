import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Save, FileText, Settings, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatVND, parseAmountShortcut } from "@/lib/format";

type Budget = any;
type Transaction = any;
type Category = any;

interface BudgetDetailsModalProps {
  budget: Budget | null;
  open: boolean;
  onClose: () => void;
  categories: Category[];
  transactions: Transaction[];
}

const PERIODS = [
  { v: "1", label: "1 tháng" },
  { v: "3", label: "3 tháng" },
  { v: "6", label: "6 tháng" },
  { v: "12", label: "12 tháng" },
] as const;

export function BudgetDetailsModal({
  budget,
  open,
  onClose,
  categories,
  transactions,
}: BudgetDetailsModalProps) {
  const [tab, setTab] = useState<"txs" | "edit">("txs");
  const [amountStr, setAmountStr] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [period, setPeriod] = useState<"1" | "3" | "6" | "12">("1");

  const qc = useQueryClient();

  useEffect(() => {
    if (budget && open) {
      setAmountStr(budget.amount.toString());
      setCategoryId(budget.category_id);
      setPeriod(budget.period as any);
      setTab("txs");
    }
  }, [budget, open]);

  const update = useMutation({
    mutationFn: async () => {
      if (!budget) throw new Error("Không có ngân sách");
      const amt = parseAmountShortcut(amountStr);
      if (!amt || !categoryId) throw new Error("Thiếu thông tin");
      const { error } = await supabase
        .from("budgets")
        .update({
          category_id: categoryId,
          amount: amt,
          period,
        })
        .eq("id", budget.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Đã cập nhật ngân sách");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open || !budget) return null;

  const cat = categories.find((c) => c.id === budget.category_id);
  const start = new Date(budget.start_date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(budget.period));
  const now = new Date();

  const matchingTxs = transactions.filter((t) => {
    if (t.category_id !== budget.category_id) return false;
    const d = new Date(t.occurred_at);
    return d >= start && d < end;
  }).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  const used = matchingTxs.reduce((s, t) => s + Number(t.amount), 0);
  const limit = Number(budget.amount);
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const danger = pct >= 90;
  const warn = pct >= 70;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-card shadow-[var(--shadow-soft)] sm:rounded-3xl"
      >
        <div className="flex-none p-5 pb-0">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-semibold">
                Chi tiết ngân sách
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{cat?.icon}</span>
              <span className="font-medium">{cat?.name}</span>
            </div>
            <div className="flex items-end justify-between">
              <p className="font-display text-2xl font-semibold">
                {formatVND(used)}
              </p>
              <p className="text-sm text-muted-foreground">
                / {formatVND(limit)}
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full transition-all",
                  danger
                    ? "bg-destructive"
                    : warn
                      ? "bg-warning"
                      : "bg-[image:var(--gradient-primary)]",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setTab("txs")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                tab === "txs"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText className="h-4 w-4" /> Giao dịch
            </button>
            <button
              onClick={() => setTab("edit")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                tab === "edit"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Settings className="h-4 w-4" /> Chỉnh sửa
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "txs" ? (
            <div className="space-y-3">
              {matchingTxs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Chưa có giao dịch nào trong chu kỳ này.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {matchingTxs.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium">{t.note || cat?.name || "Giao dịch"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.occurred_at).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                      <span className="font-display text-sm font-semibold text-destructive">
                        -{formatVND(Number(t.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Danh mục</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Giới hạn (VNĐ)</label>
                <input
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="VD: 2000000 hoặc 2tr"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Chu kỳ</label>
                <div className="grid grid-cols-4 gap-2">
                  {PERIODS.map((p) => (
                    <button
                      key={p.v}
                      onClick={() => setPeriod(p.v)}
                      className={cn(
                        "rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
                        period === p.v
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={update.isPending || !amountStr}
                onClick={() => update.mutate()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-opacity disabled:opacity-50"
              >
                {update.isPending ? "Đang lưu…" : (
                  <>
                    <Save className="h-4 w-4" />
                    Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
