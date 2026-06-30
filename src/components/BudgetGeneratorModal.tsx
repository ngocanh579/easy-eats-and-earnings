import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { formatVND } from "@/lib/format";
import {
  generateBudgetSuggestions,
  type BudgetSuggestion,
} from "@/lib/budget-suggestions";
import { cn } from "@/lib/utils";

interface BudgetGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  monthlyIncome: number;
  existingCategories: any[];
  onSuccess?: () => void;
}

export function BudgetGeneratorModal({
  open,
  onClose,
  monthlyIncome,
  existingCategories,
  onSuccess,
}: BudgetGeneratorModalProps) {
  const qc = useQueryClient();
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5, 6, 7, 8])
  );

  const suggestions = useMemo(() => {
    return generateBudgetSuggestions(monthlyIncome);
  }, [monthlyIncome]);

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndexes);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndexes(newSet);
  };

  const selectedTotal = useMemo(() => {
    return Array.from(selectedIndexes).reduce((sum, idx) => {
      return sum + (suggestions[idx]?.amount || 0);
    }, 0);
  }, [selectedIndexes, suggestions]);

  const create = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");

      // Get all existing expense categories for reference
      const { data: allCats } = await supabase
        .from("categories")
        .select("id, name, kind")
        .eq("kind", "expense");

      const selectedSuggestions = Array.from(selectedIndexes).map(
        (idx) => suggestions[idx]
      );

      // For each selected suggestion, try to find matching category or skip
      const budgetsToCreate = selectedSuggestions
        .map((sug) => {
          // Try to find a matching category by name similarity
          const existingCat = existingCategories.find(
            (c) =>
              c.name.toLowerCase().includes(sug.categoryName.toLowerCase()) ||
              sug.categoryName.toLowerCase().includes(c.name.toLowerCase())
          );

          if (!existingCat) {
            console.log(`[v0] Category not found for: ${sug.categoryName}`);
            return null;
          }

          return {
            user_id: user.id,
            category_id: existingCat.id,
            amount: sug.amount,
            period: "1" as const,
            start_date: new Date().toISOString().split("T")[0],
          };
        })
        .filter((b) => b !== null);

      if (budgetsToCreate.length === 0) {
        throw new Error(
          "Không tìm thấy danh mục phù hợp. Vui lòng tạo danh mục trước."
        );
      }

      const { error } = await supabase
        .from("budgets")
        .insert(budgetsToCreate);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Đã tạo ${selectedIndexes.size} ngân sách!`);
      qc.invalidateQueries({ queryKey: ["budgets"] });
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
        className="fixed bottom-0 left-0 right-0 sm:absolute sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-background p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between sticky top-0 bg-background">
          <h3 className="text-lg font-semibold">Gợi ý ngân sách thông minh</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Chọn những danh mục bạn muốn tạo ngân sách dựa trên thu nhập{" "}
          <span className="font-semibold text-foreground">{formatVND(monthlyIncome)}</span>
        </p>

        <div className="space-y-2">
          {suggestions.map((sug, idx) => {
            const isSelected = selectedIndexes.has(idx);
            return (
              <button
                key={idx}
                onClick={() => toggleSelection(idx)}
                className={cn(
                  "w-full text-left rounded-lg border transition-all p-3 flex items-start gap-3",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 transition-all",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    <span className="text-lg">{sug.categoryIcon}</span>
                    {sug.categoryName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sug.description}
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    {sug.percentage}% ({formatVND(sug.amount)}/tháng)
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tổng cộng:</span>
            <span className="font-semibold">
              {formatVND(selectedTotal)} / tháng
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Huỷ
            </button>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || selectedIndexes.size === 0}
              className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {create.isPending
                ? "Đang tạo..."
                : `Tạo ${selectedIndexes.size} ngân sách`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
