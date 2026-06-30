"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { X, Send, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const feedbackSchema = z.object({
  title: z.string().min(5, "Tiêu đề phải từ 5 ký tự trở lên").max(100, "Tiêu đề không quá 100 ký tự"),
  content: z.string().min(10, "Nội dung phải từ 10 ký tự trở lên").max(2000, "Nội dung không quá 2000 ký tự"),
  type: z.enum(["bug", "feature", "design", "other"], { message: "Vui lòng chọn loại góp ý" }),
  email: z.string().email("Email không hợp lệ"),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FeedbackModal({ open, onClose, onSuccess }: FeedbackModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      type: "bug",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("content", data.content);
      formData.append("type", data.type);
      formData.append("email", data.email);

      if (selectedFile) {
        formData.append("attachment", selectedFile);
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Cảm ơn bạn đã gửi góp ý!");
      reset();
      setSelectedFile(null);
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = async (data: FeedbackFormData) => {
    mutation.mutate(data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Kích thước file không vượt quá 5MB");
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error("Chỉ hỗ trợ ảnh JPG, PNG, WebP");
        return;
      }
      setSelectedFile(file);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold">Gửi góp ý & hỗ trợ</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Tiêu đề</label>
            <input
              {...register("title")}
              type="text"
              placeholder="Ví dụ: Ứng dụng bị crash khi mở..."
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                errors.title ? "border-red-500" : "border-input"
              )}
            />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Loại góp ý</label>
            <select
              {...register("type")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="bug">Báo lỗi</option>
              <option value="feature">Đề xuất tính năng</option>
              <option value="design">Giao diện</option>
              <option value="other">Khác</option>
            </select>
            {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Nội dung</label>
            <textarea
              {...register("content")}
              placeholder="Mô tả chi tiết về góp ý của bạn..."
              rows={5}
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none",
                errors.content ? "border-red-500" : "border-input"
              )}
            />
            {errors.content && <p className="text-xs text-red-500">{errors.content.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Email</label>
            <input
              {...register("email")}
              type="email"
              placeholder="email@example.com"
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                errors.email ? "border-red-500" : "border-input"
              )}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          {/* Image Attachment */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Ảnh đính kèm (tùy chọn)</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-accent/30 py-6 px-3 cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {selectedFile ? selectedFile.name : "Nhấp để chọn ảnh (JPG, PNG, WebP, max 5MB)"}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {mutation.isPending ? "Đang gửi..." : "Gửi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
