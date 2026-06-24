import { friendlyError } from "@/lib/errors";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EditTransactionModal, TransactionToEdit } from "@/components/EditTransactionModal";
import { formatVND } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
});

type Kind = "expense" | "income" | "debt" | "savings";
const KINDS: { v: Kind; label: string; emoji: string }[] = [
  { v: "expense", label: "Chi tiêu", emoji: "💸" },
  { v: "income", label: "Thu nhập", emoji: "💰" },
  { v: "debt", label: "Tiền nợ", emoji: "📥" },
  { v: "savings", label: "Tiết kiệm", emoji: "🐖" },
];

const EMOJI = [
  "🍜", "🍔", "🍕", "☕", "🍺", "🥑", "🍰", "🍎",
  "🛒", "🛍️", "🚕", "🚌", "✈️", "⛽", "🚲", "🚢",
  "🧾", "🎬", "🎤", "🎮", "🎫", "🎡", "🎧", "📸",
  "🏠", "🛠️", "💡", "💧", "💊", "🏥", "🦷", "🧼",
  "👕", "👗", "👟", "💈", "🏋️", "🐾", "🐶", "🐱",
  "📚", "🎓", "🎁", "💼", "💸", "💳", "📱", "💻"
];

function CategoriesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Kind>("expense");
  const [open, setOpen] = useState<{ type: "add", parent_id: string | null } | { type: "edit", category: any } | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🍜");
  const [selectedCat, setSelectedCat] = useState<any | null>(null);
  const [editingTx, setEditingTx] = useState<TransactionToEdit | null>(null);

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
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
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  const catTxs = useMemo(() => {
    if (!selectedCat || !txs.data) return [];
    const catIds = [selectedCat.id];
    if (!selectedCat.parent_id) {
      const children = (cats.data ?? []).filter((c) => c.parent_id === selectedCat.id);
      catIds.push(...children.map((c) => c.id));
    }
    return txs.data.filter((t) => catIds.includes(t.category_id));
  }, [selectedCat, txs.data, cats.data]);

  const delTx = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["wallets"] }); // Wallet balance is now updated by DB trigger
      toast.success("Đã xoá giao dịch");
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const grouped = useMemo(() => {
    const list = (cats.data ?? []).filter((c) => c.kind === tab);
    const parents = list.filter((c) => !c.parent_id);
    return parents.map((p) => ({
      ...p,
      children: list.filter((c) => c.parent_id === p.id),
    }));
  }, [cats.data, tab]);

  const create = useMutation({
    mutationFn: async () => {
      if (open?.type !== "add") return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Chưa đăng nhập");
      const { error } = await supabase.from("categories").insert({
        user_id: u.user.id,
        name: name.trim(),
        kind: tab,
        parent_id: open.parent_id,
        icon,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Đã thêm danh mục");
      setName("");
      setOpen(null);
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (open?.type !== "edit") return;
      const { error } = await supabase.from("categories").update({
        name: name.trim(),
        icon,
      }).eq("id", open.category.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Đã cập nhật danh mục");
      setName("");
      setOpen(null);
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Đã xoá");
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold lg:text-3xl">Danh mục</h1>
        <p className="text-sm text-muted-foreground">
          4 nhóm chính, có thể thêm danh mục con tuỳ ý.
        </p>
      </div>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {KINDS.map((k) => (
          <button
            key={k.v}
            onClick={() => setTab(k.v)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              tab === k.v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {k.emoji} {k.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-medium">{KINDS.find((k) => k.v === tab)?.label}</h3>
          <button
            onClick={() => {
              setName("");
              setIcon("🍜");
              setOpen({ type: "add", parent_id: null });
            }}
            className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20"
          >
            <Plus className="h-4 w-4" /> Thêm
          </button>
        </div>
        <ul className="divide-y divide-border">
          {grouped.map((p) => (
            <li key={p.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{p.icon ?? "🏷️"}</span>
                <span
                  onClick={() => setSelectedCat(p)}
                  className="flex-1 font-medium cursor-pointer hover:underline hover:text-primary transition-all"
                  title="Bấm để xem danh sách giao dịch"
                >
                  {p.name}
                </span>
                <button
                  onClick={() => {
                    setName(p.name);
                    setIcon(p.icon || "🏷️");
                    setOpen({ type: "edit", category: p });
                  }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Sửa danh mục"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setName("");
                    setIcon("🍜");
                    setOpen({ type: "add", parent_id: p.id });
                  }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Thêm danh mục con"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Xoá "${p.name}" và các danh mục con?`)) del.mutate(p.id);
                  }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {p.children.length > 0 && (
                <ul className="ml-8 mt-2 space-y-1.5">
                  {p.children.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{c.icon ?? "•"}</span>
                      <span
                        onClick={() => setSelectedCat(c)}
                        className="flex-1 cursor-pointer hover:underline hover:text-primary transition-all"
                        title="Bấm để xem danh sách giao dịch"
                      >
                        {c.name}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setName(c.name);
                            setIcon(c.icon || "•");
                            setOpen({ type: "edit", category: c });
                          }}
                          className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground text-muted-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => del.mutate(c.id)}
                          className="rounded-lg p-1.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {grouped.length === 0 && (
            <li className="p-10 text-center text-sm text-muted-foreground">
              Chưa có danh mục.
            </li>
          )}
        </ul>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-card p-5 shadow-[var(--shadow-soft)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">
              {open.type === "edit" ? "Sửa danh mục" : open.parent_id ? "Thêm danh mục con" : "Thêm danh mục"}
            </h3>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên danh mục"
              className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-3 grid grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  onClick={() => setIcon(e)}
                  className={cn(
                    "rounded-lg border p-1 text-xl transition-colors aspect-square flex items-center justify-center",
                    icon === e ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setOpen(null)}
                className="flex-1 rounded-xl bg-muted px-4 py-3 font-medium text-foreground hover:bg-accent transition-colors"
              >
                Huỷ
              </button>
              <button
                disabled={!name.trim() || (open.type === "add" ? create.isPending : update.isPending)}
                onClick={() => open.type === "add" ? create.mutate() : update.mutate()}
                className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
              >
                {open.type === "edit" ? "Lưu" : "Thêm"}
              </button>
            </div>
          </div>
        </div>
      )}
    {selectedCat && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelectedCat(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-card p-5 shadow-[var(--shadow-soft)] sm:rounded-3xl max-h-[85vh] flex flex-col"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                <span className="text-xl">{selectedCat.icon ?? "🏷️"}</span>
                <span>Giao dịch của "{selectedCat.name}"</span>
              </h3>
              <button
                onClick={() => setSelectedCat(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
              {catTxs.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  Chưa có giao dịch nào thuộc danh mục này.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {catTxs.map((t) => {
                    const w = (wallets.data ?? []).find((x) => x.id === t.wallet_id);
                    return (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 py-3 hover:bg-accent/30 rounded-lg px-2"
                      >
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-lg">
                          {selectedCat.icon ?? "🏷️"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {t.note || selectedCat.name || "Giao dịch"}
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
                                delTx.mutate(t.id);
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
