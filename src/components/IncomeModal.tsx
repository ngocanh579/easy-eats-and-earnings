import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { formatVND, parseAmountShortcut } from "@/lib/format";

interface IncomeModalProps {
  open: boolean;
  onClose: () => void;
  currentIncome: number | null;
  onSuccess?: () => void;
}

export function IncomeModal({
  open,
  onClose,
  currentIncome,
  onSuccess,
}: IncomeModalProps) {
  const [incomeStr, setIncomeStr] = useState("");

  useEffect(() => {
    if (currentIncome && open) {
      setIncomeStr(currentIncome.toString());
    }
  }, [currentIncome, open]);

  const update = useMutation({
    mutationFn: async () => {
      const income = parseAmountShortcut(incomeStr);
      if (!income || income <= 0) {
        throw new Error("Thu nhập phải > 0. VD: 10tr hoặc 500k");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");

      const { error } = await supabase.auth.updateUser({
        data: {
          monthly_income: income,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cập nhật thu nhập thành công!");
      onClose();
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(friendlyError(err));
    },
  });

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/50 transition-opacity ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className="fixed bottom-0 left-0 right-0 sm:absolute sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-96 rounded-t-2xl sm:rounded-2xl bg-background p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Thu nhập hàng tháng</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">
            Nhập thu nhập (VD: 10tr, 500k)
          </label>
          <input
            type="text"
            value={incomeStr}
            onChange={(e) => setIncomeStr(e.target.value)}
            placeholder="10tr hoặc 500k"
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-lg font-semibold outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Gợi ý: Nhập "10tr" cho 10.000.000đ hoặc "500k" cho 500.000đ
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Huỷ
          </button>
          <button
            onClick={() => update.mutate()}
            disabled={update.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {update.isPending ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
