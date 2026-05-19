import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Đăng ký thành công! Kiểm tra email để xác nhận.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        nav({ to: "/" });
      }
    } catch (err: unknown) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 shadow-[var(--shadow-soft)] backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Xu
            </h1>
            <p className="text-xs text-muted-foreground">
              Quản lý chi tiêu cá nhân
            </p>
          </div>
        </div>

        <h2 className="font-display text-xl font-semibold">
          {mode === "signin" ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Đăng nhập để tiếp tục theo dõi chi tiêu"
            : "Bắt đầu hành trình tài chính của bạn"}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none ring-ring focus:ring-2"
          />
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            minLength={6}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none ring-ring focus:ring-2"
          />
          <button
            disabled={loading}
            className="w-full rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
          >
            {loading
              ? "Đang xử lý…"
              : mode === "signin"
                ? "Đăng nhập"
                : "Đăng ký"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin"
            ? "Chưa có tài khoản? Đăng ký"
            : "Đã có tài khoản? Đăng nhập"}
        </button>
      </div>
    </div>
  );
}
