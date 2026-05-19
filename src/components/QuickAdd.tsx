import { friendlyError } from "@/lib/errors";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Zap, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseQuickAdd, formatVND } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Kind = "expense" | "income" | "debt" | "savings";

const KIND_LABEL: Record<Kind, string> = {
  expense: "Chi tiêu",
  income: "Thu nhập",
  debt: "Nợ",
  savings: "Tiết kiệm",
};

const toDatetimeLocal = (dateString: string) => {
  const d = new Date(dateString);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [walletId, setWalletId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState(() => toDatetimeLocal(new Date().toISOString()));
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setOccurredAt(toDatetimeLocal(new Date().toISOString()));
      setText("");
    }
  }, [open]);

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("id,name,icon")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,kind,icon,parent_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filteredCats = categories.filter((c) => c.kind === kind);
  const parsed = parseQuickAdd(text);

  const create = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("Định dạng không đúng. VD: 20k cafe");
      const wid = walletId || wallets[0]?.id;
      if (!wid) throw new Error("Chưa có ví. Hãy tạo ví trước.");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Chưa đăng nhập");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id,
        wallet_id: wid,
        category_id: categoryId || null,
        kind,
        amount: parsed.amount,
        note: parsed.note || null,
        occurred_at: new Date(occurredAt).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["wallets-balance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Đã thêm giao dịch");
      setText("");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-105 active:scale-95 lg:bottom-8 lg:right-8 lg:h-16 lg:w-16"
        aria-label="Thêm nhanh"
      >
        <Plus className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-[var(--shadow-soft)] sm:rounded-3xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="font-display text-lg font-semibold">
                  Thêm nhanh
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="VD: 20k cafe, 1.5tr lương…"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 font-display text-lg outline-none ring-ring placeholder:text-muted-foreground/60 focus:ring-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && parsed) create.mutate();
              }}
            />
            {parsed && (
              <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>Số tiền</span>
                <span className="font-display font-semibold text-foreground">
                  {formatVND(parsed.amount)}
                </span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setKind(k);
                    setCategoryId("");
                  }}
                  className={cn(
                    "rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                    kind === k
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Ví mặc định</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.icon} {w.name}
                  </option>
                ))}
              </select>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Không danh mục</option>
                {filteredCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              disabled={!parsed || create.isPending}
              onClick={() => create.mutate()}
              className="mt-4 w-full rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-opacity disabled:opacity-50"
            >
              {create.isPending ? "Đang lưu…" : "Lưu giao dịch"}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Mẹo: gõ <code className="font-mono">k</code> = nghìn,{" "}
              <code className="font-mono">tr</code> = triệu
            </p>
          </div>
        </div>
      )}
    </>
  );
}
