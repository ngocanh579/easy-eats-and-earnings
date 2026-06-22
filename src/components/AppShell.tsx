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
  const [isDesktop, setIsDesktop] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setIsDesktop(media.matches);
      if (media.matches) setMobileOpen(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    if (!isDesktop) setMobileOpen(false);
  }, [loc.pathname, isDesktop]);

  const isActive = (to: string) =>
    to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);

  // On mobile: sidebar is either fully shown (w-64) or fully hidden (translated off-screen).
  // On desktop: keep existing collapse/expand behavior.
  const sidebarVisible = isDesktop ? true : mobileOpen;
  const sidebarExpanded = isDesktop ? desktopOpen : true;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar with hamburger */}
      {!isDesktop && (
        <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border/70 bg-background/95 px-3 backdrop-blur-xl">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl text-foreground transition-colors hover:bg-sidebar-accent"
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-semibold tracking-tight">
              Chi Tiêu
            </span>
          </Link>
          <div className="w-10" />
        </div>
      )}

      {/* Mobile backdrop */}
      {!isDesktop && mobileOpen && (
        <button
          aria-label="Đóng menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border/70 bg-sidebar/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-transform duration-300 ease-out",
          sidebarExpanded ? "w-64" : "w-[4.5rem]",
          sidebarVisible ? "translate-x-0" : "-translate-x-full",
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

          {isDesktop ? (
            <button
              onClick={() => setDesktopOpen((open) => !open)}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                !desktopOpen &&
                  "absolute -right-3 top-4 h-9 w-9 border border-sidebar-border bg-sidebar shadow-[var(--shadow-soft)]",
              )}
              aria-label={desktopOpen ? "Thu gọn menu" : "Mở rộng menu"}
            >
              {desktopOpen ? (
                <PanelLeftClose className="h-4.5 w-4.5" />
              ) : (
                <Menu className="h-4.5 w-4.5" />
              )}
            </button>
          ) : (
            <button
              onClick={() => setMobileOpen(false)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Đóng menu"
            >
              <X className="h-5 w-5" />
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
          isDesktop ? (desktopOpen ? "pl-64" : "pl-[4.5rem]") : "pl-0 pt-14",
        )}
      >
        <div className="mx-auto max-w-7xl px-3 pb-8 pt-3 sm:px-5 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
