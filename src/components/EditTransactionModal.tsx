import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Kind = "expense" | "income" | "debt" | "savings";

const KIND_LABEL: Record<Kind, string> = {
  expense: "Chi tiêu",
  income: "Thu nhập",
  debt: "Nợ",
  savings: "Tiết kiệm",
};

export type TransactionToEdit = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  kind: Kind;
  amount: number;
  note: string | null;
  occurred_at: string;
};

interface EditTransactionModalProps {
  transaction: TransactionToEdit | null;
  open: boolean;
  onClose: () => void;
  wallets: any[];
  categories: any[];
}

// Convert ISO string or date to YYYY-MM-DDThh:mm format for datetime-local input
const toDatetimeLocal = (dateString: string) => {
  const d = new Date(dateString);
  // adjust to local timezone
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function EditTransactionModal({ transaction, open, onClose, wallets, categories }: EditTransactionModalProps) {
  const [amountStr, setAmountStr] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [walletId, setWalletId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState("");

  const qc = useQueryClient();

  useEffect(() => {
    if (transaction && open) {
      setAmountStr(transaction.amount.toString());
      setKind(transaction.kind);
      setWalletId(transaction.wallet_id);
      setCategoryId(transaction.category_id || "");
      setNote(transaction.note || "");
      setOccurredAt(toDatetimeLocal(transaction.occurred_at));
    }
  }, [transaction, open]);

  const filteredCats = categories.filter((c) => c.kind === kind);

  const update = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error("Không có giao dịch để sửa.");
      const amount = Number(amountStr);
      if (isNaN(amount) || amount <= 0) throw new Error("Số tiền không hợp lệ.");
      if (!walletId) throw new Error("Vui lòng chọn ví.");
      if (!occurredAt) throw new Error("Vui lòng chọn thời gian.");

      const { error } = await supabase
        .from("transactions")
        .update({
          wallet_id: walletId,
          category_id: categoryId || null,
          kind,
          amount,
          note: note || null,
          occurred_at: new Date(occurredAt).toISOString(),
        })
        .eq("id", transaction.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["wallets-balance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Đã cập nhật giao dịch");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open || !transaction) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-[var(--shadow-soft)] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold">
              Sửa giao dịch
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Số tiền</label>
            <input
              autoFocus
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Nhập số tiền..."
              className="w-full rounded-xl border border-input bg-background px-4 py-3 font-display text-lg outline-none ring-ring placeholder:text-muted-foreground/60 focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Ghi chú</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm..."
              className="w-full rounded-xl border border-input bg-background px-4 py-3 font-display outline-none ring-ring placeholder:text-muted-foreground/60 focus:ring-2"
            />
          </div>

          <div>
             <label className="mb-1 block text-sm font-medium text-muted-foreground">Thời gian</label>
             <input
               type="datetime-local"
               value={occurredAt}
               onChange={(e) => setOccurredAt(e.target.value)}
               className="w-full rounded-xl border border-input bg-background px-4 py-3 font-display outline-none ring-ring focus:ring-2"
             />
          </div>

          <div className="grid grid-cols-4 gap-1.5">
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

          <div className="grid grid-cols-2 gap-2">
             <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Ví</label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Chọn ví</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.icon} {w.name}
                    </option>
                  ))}
                </select>
             </div>
             <div>
                 <label className="mb-1 block text-sm font-medium text-muted-foreground">Danh mục</label>
                 <select
                   value={categoryId}
                   onChange={(e) => setCategoryId(e.target.value)}
                   className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                 >
                   <option value="">Không danh mục</option>
                   {filteredCats.map((c) => (
                     <option key={c.id} value={c.id}>
                       {c.icon} {c.name}
                     </option>
                   ))}
                 </select>
             </div>
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
    </div>
  );
}
