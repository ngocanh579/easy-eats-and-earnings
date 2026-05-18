import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wallet as WalletIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatVND, parseAmountShortcut } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wallets")({
  component: WalletsPage,
});

const TYPES = [
  { v: "cash", label: "Tiền mặt", icon: "💵" },
  { v: "bank", label: "Ngân hàng", icon: "🏦" },
  { v: "ewallet", label: "Ví điện tử", icon: "📱" },
  { v: "savings", label: "Tiết kiệm", icon: "🐖" },
  { v: "other", label: "Khác", icon: "💼" },
] as const;

function WalletsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]["v"]>("cash");
  const [balance, setBalance] = useState("");

  const parsedPreview = useMemo(() => {
    const hasLetters = /[a-zA-Z]/g.test(balance);
    if (!hasLetters) return null;
    const parsed = parseAmountShortcut(balance);
    if (parsed !== null && parsed > 0) {
      return formatVND(parsed);
    }
    return null;
  }, [balance]);

  const handleAmountBlur = () => {
    const parsed = parseAmountShortcut(balance);
    if (parsed !== null && parsed > 0) {
      setBalance(parsed.toLocaleString("vi-VN"));
    } else {
      const clean = balance.replace(/[^0-9]/g, "");
      if (clean) {
        const num = parseFloat(clean);
        setBalance(num.toLocaleString("vi-VN"));
      }
    }
  };

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
        .select("wallet_id, kind, amount");
      if (error) throw error;
      return data;
    },
  });

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of wallets.data ?? []) map.set(w.id, Number(w.initial_balance));
    for (const t of txs.data ?? []) {
      const sign = t.kind === "income" ? 1 : t.kind === "expense" ? -1 : 0;
      map.set(t.wallet_id, (map.get(t.wallet_id) ?? 0) + sign * Number(t.amount));
    }
    return map;
  }, [wallets.data, txs.data]);

  const create = useMutation({
    mutationFn: async () => {
      const t = TYPES.find((x) => x.v === type)!;
      const amt = parseAmountShortcut(balance) ?? 0;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Chưa đăng nhập");
      const { error } = await supabase.from("wallets").insert({
        user_id: u.user.id,
        name: name.trim() || t.label,
        type,
        initial_balance: amt,
        icon: t.icon,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Đã tạo ví");
      setOpen(false);
      setName("");
      setBalance("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wallets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Đã xoá ví");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold lg:text-3xl">Ví</h1>
          <p className="text-sm text-muted-foreground">
            Tạo nhiều ví: tiền mặt, ngân hàng, tiết kiệm…
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Thêm ví
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(wallets.data ?? []).map((w) => (
          <div
            key={w.id}
            className="group relative rounded-2xl border border-border bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-xl">
                {w.icon ?? "💼"}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{w.name}</p>
                <p className="text-xs text-muted-foreground">
                  {TYPES.find((t) => t.v === w.type)?.label}
                </p>
              </div>
            </div>
            <p className="mt-4 font-display text-2xl font-semibold">
              {formatVND(balances.get(w.id) ?? 0)}
            </p>
            <button
              onClick={() => {
                if (confirm(`Xoá ví "${w.name}"? Mọi giao dịch của ví cũng sẽ bị xoá.`))
                  del.mutate(w.id);
              }}
              className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {(wallets.data ?? []).length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <WalletIcon className="mx-auto mb-2 h-6 w-6 opacity-40" />
            Chưa có ví nào.
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
            <h3 className="font-display text-lg font-semibold">Thêm ví</h3>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên ví"
              className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-3 grid grid-cols-5 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.v}
                  onClick={() => setType(t.v)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] transition-colors",
                    type === t.v
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  <span className="text-lg">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative mt-3">
              <input
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                onBlur={handleAmountBlur}
                placeholder="Số dư ban đầu (VD: 500k, 10tr...)"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
              />
              {parsedPreview && (
                <span className="text-[10px] text-success font-semibold mt-1 block animate-pulse">
                  = {parsedPreview}
                </span>
              )}
            </div>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="mt-4 w-full rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
            >
              Tạo ví
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
