import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, History, Landmark, ShieldAlert, LogOut, Receipt, Settings as SettingsIcon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import actualLogo from "@/assets/actual_logo.jpg.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, useSidebar,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bills", label: "Pay Bills", icon: Receipt },
  { to: "/history", label: "Transactions", icon: History },
  { to: "/loans", label: "Loans", icon: Landmark },
  { to: "/audit", label: "Audit & Alerts", icon: ShieldAlert },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function AuthedLayout() {
  const [displayName, setDisplayName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name = (meta.full_name as string) || (meta.name as string) || u.email?.split("@")[0] || "";
      setDisplayName(name);
    });
  }, []);
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar displayName={displayName} />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-10">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState("");
  const { setOpenMobile, isMobile } = useSidebar();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1 font-semibold">
          <img src={actualLogo.url} alt="NexTim" className="logo-blend h-8 w-8 object-contain" />
          <span>NexTim</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((n) => {
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                return (
                  <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link
                        to={n.to}
                        onClick={() => isMobile && setOpenMobile(false)}
                        className="flex items-center gap-2"
                      >
                        <n.icon className="h-4 w-4" />
                        <span>{n.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 pb-1 text-xs text-muted-foreground truncate" title={email}>{email}</div>
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar({ displayName }: { displayName: string }) {
  const { toggleSidebar } = useSidebar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"));
  const title = current?.label ?? "NexTim";
  const Icon = current?.icon;

  return (
    <header className="border-b border-border/60 bg-card sticky top-0 z-10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Toggle navigation"
            title="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="NexTim home">
            <img src={actualLogo.url} alt="NexTim" className="logo-blend h-7 w-7 object-contain" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="h-5 w-5 text-primary shrink-0" />}
            <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {displayName && (
            <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[180px]">
              Hi, <span className="text-foreground font-medium">{displayName}</span>
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}