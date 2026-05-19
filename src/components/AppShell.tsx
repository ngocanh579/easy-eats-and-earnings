import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Tags,
  Target,
  Receipt,
  Moon,
  Sun,
  LogOut,
  Sparkles,
  ShoppingBag,
  Menu,
  PanelLeftClose,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/transactions", label: "Giao dịch", icon: Receipt },
  { to: "/wallets", label: "Ví", icon: Wallet },
  { to: "/categories", label: "Danh mục", icon: Tags },
  { to: "/budgets", label: "Ngân sách", icon: Target },
  { to: "/smart-plan", label: "Kế hoạch", icon: Sparkles },
  { to: "/shopping-assistant", label: "Trợ lý mua sắm", icon: ShoppingBag },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { theme, toggle } = useTheme();
  const isMobile = useIsMobile();
  const [desktopExpanded, setDesktopExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobile && mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isMobile, mobileOpen]);

  const isActive = (to: string) =>
    to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);

  // On mobile: sidebar is overlay (full open or hidden). On desktop: persistent rail.
  const sidebarVisible = isMobile ? mobileOpen : true;
  const sidebarExpanded = isMobile ? true : desktopExpanded;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      {isMobile && (
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/95 px-3 backdrop-blur-xl">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl text-foreground transition-colors hover:bg-accent"
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-2" aria-label="Trang tổng quan">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="font-display text-base font-semibold tracking-tight">
              Chi Tiêu
            </span>
          </Link>
          <div className="h-10 w-10" aria-hidden />
        </header>
      )}

      {/* Mobile overlay backdrop */}
      {isMobile && mobileOpen && (
        <button
          aria-label="Đóng menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border/70 bg-sidebar/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl",
          isMobile
            ? cn(
                "w-72 transition-transform duration-300 ease-out",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
              )
            : cn(
                "transition-[width] duration-300 ease-out",
                desktopExpanded ? "w-64" : "w-[4.5rem]",
              ),
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-2">
          <Link
            to="/"
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:bg-sidebar-accent/60",
              !sidebarExpanded && "justify-center",
            )}
            aria-label="Trang tổng quan"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <span
              className={cn(
                "truncate font-display text-lg font-semibold tracking-tight transition-opacity",
                sidebarExpanded ? "opacity-100" : "pointer-events-none hidden opacity-0",
              )}
            >
              Chi Tiêu
            </span>
          </Link>

          {isMobile ? (
            <button
              onClick={() => setMobileOpen(false)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Đóng menu"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          ) : (
            <button
              onClick={() => setDesktopExpanded((open) => !open)}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                !desktopExpanded &&
                  "absolute -right-3 top-4 h-9 w-9 border border-sidebar-border bg-sidebar shadow-[var(--shadow-soft)]",
              )}
              aria-label={desktopExpanded ? "Thu gọn menu" : "Mở rộng menu"}
            >
              {desktopExpanded ? (
                <PanelLeftClose className="h-4.5 w-4.5" />
              ) : (
                <Menu className="h-4.5 w-4.5" />
              )}
            </button>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={!sidebarExpanded ? item.label : undefined}
                className={cn(
                  "flex min-h-12 items-center rounded-2xl text-sm font-medium transition-all duration-200",
                  sidebarExpanded ? "gap-3 px-3" : "justify-center px-0",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span
                  className={cn(
                    "truncate transition-opacity",
                    sidebarExpanded ? "opacity-100" : "pointer-events-none hidden opacity-0",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1.5 border-t border-sidebar-border/70 pt-3">
          <button
            onClick={toggle}
            title={!sidebarExpanded ? (theme === "dark" ? "Sáng" : "Tối") : undefined}
            className={cn(
              "flex min-h-12 items-center rounded-2xl text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground",
              sidebarExpanded ? "gap-3 px-3" : "justify-center px-0",
            )}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 shrink-0" />
            ) : (
              <Moon className="h-5 w-5 shrink-0" />
            )}
            <span className={cn(sidebarExpanded ? "block" : "hidden")}>
              {theme === "dark" ? "Sáng" : "Tối"}
            </span>
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              nav({ to: "/login" });
            }}
            title={!sidebarExpanded ? "Đăng xuất" : undefined}
            className={cn(
              "flex min-h-12 items-center rounded-2xl text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
              sidebarExpanded ? "gap-3 px-3" : "justify-center px-0",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn(sidebarExpanded ? "block" : "hidden")}>
              Đăng xuất
            </span>
          </button>
        </div>
      </aside>

      <main
        className={cn(
          "transition-[padding] duration-300 ease-out",
          isMobile ? "pl-0" : desktopExpanded ? "pl-64" : "pl-[4.5rem]",
        )}
      >
        <div className="mx-auto max-w-7xl px-3 pb-8 pt-3 sm:px-5 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
