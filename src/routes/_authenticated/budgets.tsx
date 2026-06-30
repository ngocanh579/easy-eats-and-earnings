import { friendlyError } from "@/lib/errors";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Target, Wand2, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatVND, parseAmountShortcut } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BudgetDetailsModal } from "@/components/BudgetDetailsModal";
import { IncomeModal } from "@/components/IncomeModal";
import { BudgetGeneratorModal } from "@/components/BudgetGeneratorModal";

export const Route = createFileRoute("/_authenticated/budgets")({
  component: BudgetsPage,
});

const PERIODS = [
  { v: "1", label: "1 tháng" },
  { v: "3", label: "3 tháng" },
  { v: "6", label: "6 tháng" },
  { v: "12", label: "12 tháng" },
] as const;

function BudgetsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<"1" | "3" | "6" | "12">("1");
  const [viewingBudget, setViewingBudget] = useState<any>(null);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);

  const parsedPreview = useMemo(() => {
    const hasLetters = /[a-zA-Z]/g.test(amount);
    if (!hasLetters) return null;
    const parsed = parseAmountShortcut(amount);
    if (parsed !== null && parsed > 0) {
      return formatVND(parsed);
    }
    return null;
  }, [amount]);

  const handleAmountBlur = () => {
    const parsed = parseAmountShortcut(amount);
    if (parsed !== null && parsed > 0) {
      setAmount(parsed.toLocaleString("vi-VN"));
    } else {
      const clean = amount.replace(/[^0-9]/g, "");
      if (clean) {
        const num = parseFloat(clean);
        setAmount(num.toLocaleString("vi-VN"));
      }
    }
  };

  const user = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    },
  });

  const monthlyIncome = (user.data?.user_metadata?.monthly_income as number) || 0;

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,kind,icon")
        .eq("kind", "expense")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const budgets = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const txs = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, category_id, kind, amount, occurred_at, note")
        .eq("kind", "expense");
      if (error) throw error;
      return data;
    },
  });

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (const b of budgets.data ?? []) {
      const start = new Date(b.start_date);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const months = Number(b.period);
      const end = new Date(start);
      end.setMonth(end.getMonth() + months);
      let used = 0;
      for (const t of txs.data ?? []) {
        if (t.category_id !== b.category_id) continue;
        const d = new Date(t.occurred_at);
        if (d >= start && d < end) used += Number(t.amount);
      }
      map.set(b.id, used);
    }
    return map;
  }, [budgets.data, txs.data]);

  const create = useMutation({
    mutationFn: async () => {
      const amt = parseAmountShortcut(amount);
      if (!amt || !categoryId) throw new Error("Thiếu thông tin");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Chưa đăng nhập");
      const { error } = await supabase.from("budgets").insert({
        user_id: u.user.id,
        category_id: categoryId,
        amount: amt,
        period,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Đã tạo ngân sách");
      setOpen(false);
      setAmount("");
      setCategoryId("");
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Đã xoá");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold lg:text-3xl">Ngân sách</h1>
          <p className="text-sm text-muted-foreground">
            Đặt giới hạn chi tiêu theo danh mục.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Thu nhập:</span>
            <span className="font-semibold">{monthlyIncome > 0 ? formatVND(monthlyIncome) : "Chưa set"}</span>
            <button
              onClick={() => setIncomeModalOpen(true)}
              className="ml-1 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
              title="Chỉnh sửa thu nhập"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex gap-2">
            {monthlyIncome > 0 && (
              <button
                onClick={() => setGeneratorModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                <Wand2 className="h-4 w-4" /> Tự động
              </button>
            )}
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Thêm
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(budgets.data ?? []).map((b) => {
          const cat = (cats.data ?? []).find((c) => c.id === b.category_id);
          const used = usage.get(b.id) ?? 0;
          const limit = Number(b.amount);
          const pct = Math.min(100, Math.round((used / limit) * 100));
          const danger = pct >= 90;
          const warn = pct >= 70;
          return (
            <div
              key={b.id}
              onClick={() => setViewingBudget(b)}
              className="group relative cursor-pointer rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/50"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xl">{cat?.icon ?? "🏷️"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{cat?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    Lặp {b.period} tháng • bắt đầu{" "}
                    {new Date(b.start_date).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    del.mutate(b.id);
                  }}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-end justify-between">
                <p className="font-display text-xl font-semibold">
                  {formatVND(used)}
                </p>
                <p className="text-sm text-muted-foreground">
                  / {formatVND(limit)}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
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
              <p className="mt-2 text-xs text-muted-foreground">
                Đã dùng <span className="font-medium text-foreground">{pct}%</span>
              </p>
            </div>
          );
        })}
        {(budgets.data ?? []).length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Target className="mx-auto mb-2 h-6 w-6 opacity-40" />
            Chưa có ngân sách. Tạo để theo dõi giới hạn.
          </div>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-card p-5 shadow-[var(--shadow-soft)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Thêm ngân sách</h3>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Chọn danh mục chi tiêu</option>
              {(cats.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
            <div className="relative mt-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={handleAmountBlur}
                placeholder="Số tiền tối đa (VD: 2tr, 500k...)"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
              />
              {parsedPreview && (
                <span className="text-[10px] text-success font-semibold mt-1 block animate-pulse">
                  = {parsedPreview}
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.v}
                  onClick={() => setPeriod(p.v)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs transition-colors",
                    period === p.v
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              disabled={create.isPending}
              onClick={() => create.mutate()}
              className="mt-4 w-full rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
            >
              Lưu ngân sách
            </button>
          </div>
        </div>
      )}

      <BudgetDetailsModal
        budget={viewingBudget}
        open={!!viewingBudget}
        onClose={() => setViewingBudget(null)}
        categories={cats.data ?? []}
        transactions={txs.data ?? []}
      />

      <IncomeModal
        open={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
        currentIncome={monthlyIncome}
        onSuccess={() => user.refetch()}
      />

      <BudgetGeneratorModal
        open={generatorModalOpen}
        onClose={() => setGeneratorModalOpen(false)}
        monthlyIncome={monthlyIncome}
        existingCategories={cats.data ?? []}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["budgets"] })}
      />
    </div>
  );
}
