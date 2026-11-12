import { Link } from "@tanstack/react-router";
import { Home, Wallet, ListChecks, Dumbbell, Target, Sparkles, Bell, Store, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState, type ReactNode } from "react";
import { useData } from "@/lib/store";
import {
  registerServiceWorker,
  requestNotificationPermission,
  checkAndNotifyDueItems,
} from "@/lib/notifications";

export function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const data = useData();
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Regista o Service Worker e verifica o estado das permissões ao carregar
    void registerServiceWorker();

    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
      if (Notification.permission === "granted") {
        checkAndNotifyDueItems(data);
      }
    }
  }, [data]);

  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === "granted") {
      checkAndNotifyDueItems(data);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-32 pt-6">
      <header className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          <h1 className="truncate text-[26px] font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {permission !== "granted" && (
            <Button
              onClick={handleEnableNotifications}
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full bg-card shadow-sm"
              title="Ativar Notificações"
            >
              <Bell className="h-4 w-4 text-primary" />
            </Button>
          )}
          {action}
        </div>
      </header>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border bg-card p-4 shadow-[var(--shadow-float)] ${className}`}>{children}</section>;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("gv-theme", next ? "dark" : "light"); } catch { /* ignore */ }
  };
  return (
    <Button onClick={toggle} variant="outline" size="icon" className="h-10 w-10 rounded-full bg-card shadow-sm" aria-label={dark ? "Usar modo claro" : "Usar modo escuro"} title={dark ? "Modo claro" : "Modo escuro"}>
      {dark ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-primary" />}
    </Button>
  );
}

const NAV = [
  { to: "/", label: "Início", icon: Home, exact: true },
  { to: "/financas", label: "Finanças", icon: Wallet },
  { to: "/negocio", label: "Negócio", icon: Store },
  { to: "/assistente", label: "IA", icon: Sparkles, center: true },
  { to: "/rotina", label: "Rotina", icon: ListChecks },
  { to: "/treinos", label: "Treinos", icon: Dumbbell },
  { to: "/metas", label: "Metas", icon: Target },
] as const;

export function BottomNav() {
  return (
    <nav aria-label="Navegação principal" className="pill-nav fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-end px-1 pt-1.5">
        {NAV.map((n) => {
          const Icon = n.icon;
          if ("center" in n)
            return (
              <Link key={n.to} to={n.to} aria-label="Assistente IA" className="group flex min-w-0 flex-1 flex-col items-center gap-1 text-[10px] font-medium text-muted-foreground" activeProps={{ className: "text-primary" }}>
                <span className="-mt-5 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow ring-4 ring-background">
                  <Icon className="h-5 w-5" />
                </span>
                {n.label}
              </Link>
            );
          return (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              className="relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-primary font-semibold [&>span]:opacity-100" }}
            >
              <span className="absolute top-0 h-0.5 w-6 rounded-full bg-primary opacity-0" />
              <Icon className="h-5 w-5" />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
