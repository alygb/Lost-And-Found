"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { User as AuthUser } from "@supabase/supabase-js";
import {
  Bell, CheckCheck, ChevronDown, ChevronRight, ChevronsLeft, Compass, CornerDownLeft, Home,
  LayoutDashboard, LogIn, LogOut, Menu, MessageSquare, PackagePlus, PackageSearch, Plus, Search,
  Shield, Sparkles, User, UserPlus, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import RecoveryAssistant from "@/components/assistant/RecoveryAssistant";
import AdminChatWidget from "@/components/chat/AdminChatWidget";

type Profile = { full_name: string | null; avatar_url: string | null; role: string | null };
type Notification = { id: string; title: string; message: string; created_at: string; type?: string | null; link?: string | null };

const NAV = [
  {
    section: "Explore",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, auth: true },
      { href: "/matches", label: "Matches", icon: Sparkles, auth: true },
    ],
  },
  {
    section: "Report",
    items: [
      { href: "/report-lost", label: "Report Lost", icon: PackageSearch },
      { href: "/report-found", label: "Report Found", icon: PackagePlus },
    ],
  },
  {
    section: "Account",
    items: [
      { href: "/profile", label: "Profile", icon: User, auth: true },
    ],
  },
] as const;

const TITLES: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/matches": "Matches",
  "/report-lost": "Report a Lost Item",
  "/report-found": "Report a Found Item",
  "/messages": "Messages",
  "/profile": "My Profile",
  "/item": "Item Details",
  "/banned": "Account Suspended",
};

// ── Sidebar collapsed state, remembered per browser ──
const COLLAPSE_KEY = "ajk-sidebar-collapsed";
const collapseListeners = new Set<() => void>();
const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
};
const writeCollapsed = (v: boolean) => {
  try { localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0"); } catch {}
  collapseListeners.forEach((l) => l());
};
const subscribeCollapsed = (l: () => void) => {
  collapseListeners.add(l);
  return () => collapseListeners.delete(l);
};

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ profile, size = "h-9 w-9" }: { profile: Profile | null; size?: string }) {
  const initial = profile?.full_name?.charAt(0).toUpperCase() || "U";
  return profile?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar_url} alt="" className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white/20`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white`}>
      {initial}
    </span>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  // Which floating chat is open (only one at a time)
  const [dock, setDock] = useState<null | "assistant" | "admin">(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [openReport, setOpenReport] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Stronger top-bar shadow once the page is scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Auth + profile + notifications ──
  useEffect(() => {
    const load = async (uid: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,avatar_url,role")
        .eq("id", uid)
        .single();
      setProfile(data);
      const { data: n } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(10);
      setNotifications(n || []);
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) load(user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) setTimeout(() => load(u.id), 0);
      else {
        setProfile(null);
        setNotifications([]);
        setUnreadMessages(0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── New notifications arrive live (e.g. "someone commented on your item") ──
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`shell-notifications-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        const n = p.new as Notification & { is_read?: boolean };
        if (!n.is_read) setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, 10)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ── Unread admin replies ──
  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read_by_user", false);
      setUnreadMessages(count || 0);
    };
    refresh();
    const channel = supabase
      .channel(`shell-messages-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` }, () => refresh())
      // DELETE events ignore column filters, so refresh the badge on any deletion.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, pathname]);

  // ── Close dropdowns on outside click / Escape ──
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setOpenNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setOpenProfile(false);
      if (reportRef.current && !reportRef.current.contains(e.target as Node)) setOpenReport(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenNotif(false);
        setOpenProfile(false);
        setOpenReport(false);
        setOpenSearch(false);
        setMobileOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setActiveIdx(0);
        setOpenSearch((v) => !v);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const closeMenus = () => {
    setMobileOpen(false);
    setOpenNotif(false);
    setOpenProfile(false);
    setOpenReport(false);
    setOpenSearch(false);
  };

  const openPalette = () => {
    setQuery("");
    setActiveIdx(0);
    setOpenSearch(true);
  };

  const goTo = (href: string) => {
    closeMenus();
    router.push(href);
  };

  const openNotification = async (n: Notification) => {
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    if (n.link) {
      closeMenus();
      router.push(n.link);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
    setNotifications([]);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    closeMenus();
    router.push("/");
  };

  // Login and register keep their own full-screen layouts
  if (pathname === "/login" || pathname === "/register" || pathname === "/reset-password") return <>{children}</>;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const title = TITLES[pathname] ?? TITLES["/" + pathname.split("/")[1]] ?? "AJK Lost & Found";
  const isAdmin = profile?.role === "admin";
  const firstName = profile?.full_name?.split(" ")[0] || "Account";

  const q = query.trim().toLowerCase();
  const results = [
    ...NAV.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, icon: i.icon, group: g.section }))),
    ...(isAdmin ? [{ href: "/admin", label: "Admin panel", icon: Shield, group: "Admin" }] : []),
  ].filter((r) => !q || r.label.toLowerCase().includes(q));
  const open = !collapsed; // desktop sidebar visible

  // ☰ hides/shows the sidebar on desktop, opens the drawer on phones
  const toggleSidebar = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) writeCollapsed(!collapsed);
    else setMobileOpen((v) => !v);
  };

  const sidebar = (mobile: boolean) => (
    <div className="flex h-full w-64 flex-col bg-sidebar text-slate-300">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
        <Link href="/" onClick={closeMenus} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-glow">
            <Compass className="h-5 w-5" />
          </span>
          <span className="whitespace-nowrap text-[15px] font-extrabold tracking-tight text-white">
            AJK <span className="text-blue-400">Lost &amp; Found</span>
          </span>
        </Link>
        <button
          onClick={() => (mobile ? setMobileOpen(false) : writeCollapsed(true))}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close sidebar"
          title="Hide sidebar"
        >
          {mobile ? <X className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Quick action */}
      <div className="px-4 pt-5">
        <Link
          href="/report-lost"
          onClick={closeMenus}
          className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:brightness-110"
        >
          <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
          Report an item
        </Link>
      </div>

      {/* Links */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{group.section}</p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const badge = "badge" in item && unreadMessages > 0 && !active ? unreadMessages : 0;
                const href = "auth" in item && item.auth && !user ? "/login" : item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={href}
                      onClick={closeMenus}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        active ? "bg-white/10 text-white" : "text-slate-400 hover:translate-x-0.5 hover:bg-sidebar-hover hover:text-white"
                      }`}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-400" />}
                      <Icon className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? "text-blue-400" : ""}`} />
                      <span className="flex-1 whitespace-nowrap">{item.label}</span>
                      {badge > 0 && (
                        <span className="animate-pulse-ring flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/20"
          >
            <Shield className="h-[18px] w-[18px] shrink-0" />
            Admin panel
          </Link>
        )}
      </nav>

      {/* Footer: user card or sign-in */}
      <div className="border-t border-white/5 p-3">
        {user ? (
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Avatar profile={profile} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{profile?.full_name || "Your account"}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <button onClick={logout} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/15 hover:text-red-400" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Link href="/login" onClick={closeMenus} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
            <Link href="/register" onClick={closeMenus} className="flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-sidebar transition hover:bg-blue-50">
              <UserPlus className="h-4 w-4" /> Create account
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar — slides out when hidden */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden w-64 transition-transform duration-300 ease-out lg:block ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!open}
        inert={!open}
      >
        {sidebar(false)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="animate-slide-in-left absolute inset-y-0 left-0 max-w-[85vw] shadow-2xl">{sidebar(true)}</aside>
        </div>
      )}

      {/* Main column */}
      <div className={`flex min-h-screen flex-col transition-[padding] duration-300 ease-out ${open ? "lg:pl-64" : "lg:pl-0"}`}>
        {/* Top bar */}
        <header
          className={`sticky top-0 z-30 border-b transition-all duration-300 ${
            scrolled ? "border-slate-200/80 bg-white/85 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl" : "border-transparent bg-surface/60 backdrop-blur-md"
          }`}
        >
          <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <button
              onClick={toggleSidebar}
              className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-brand active:scale-95"
              aria-label="Toggle sidebar"
              title="Show / hide sidebar"
            >
              <Menu className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
            </button>

            {/* Title + breadcrumb */}
            <div key={title} className="animate-fade-in min-w-0 flex-1">
              <p className="hidden items-center gap-1 text-[11px] font-semibold text-slate-400 sm:flex">
                <Link href="/" className="transition hover:text-brand">AJK Lost &amp; Found</Link>
                <ChevronRight className="h-3 w-3" />
                <span className="truncate text-slate-500">{title}</span>
              </p>
              <h1 className="truncate text-base font-extrabold leading-tight text-slate-900 sm:text-lg">{title}</h1>
            </div>

            {/* Search trigger */}
            <button
              onClick={openPalette}
              className="group hidden h-10 w-56 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-600 md:flex xl:w-72"
            >
              <Search className="h-4 w-4 transition group-hover:text-brand" />
              <span className="flex-1 text-left">Search pages…</span>
              <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-bold text-slate-500">Ctrl K</kbd>
            </button>
            <button
              onClick={openPalette}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 md:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Report dropdown */}
            <div className="relative hidden sm:block" ref={reportRef}>
              <button
                onClick={() => { setOpenReport(!openReport); setOpenNotif(false); setOpenProfile(false); }}
                className="group flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-bold text-white shadow-glow transition hover:brightness-110 active:scale-95"
              >
                <Plus className={`h-4 w-4 transition-transform duration-300 ${openReport ? "rotate-45" : "group-hover:rotate-90"}`} />
                Report
              </button>
              {openReport && (
                <div className="animate-fade-down absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-pop">
                  {[
                    { href: "/report-lost", icon: PackageSearch, title: "I lost something", text: "Post a lost item report", tint: "bg-rose-50 text-rose-500" },
                    { href: "/report-found", icon: PackagePlus, title: "I found something", text: "Help return an item", tint: "bg-emerald-50 text-emerald-600" },
                  ].map((r) => (
                    <Link key={r.href} href={r.href} onClick={closeMenus} className="group flex items-center gap-3 rounded-xl p-3 transition hover:bg-slate-50">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${r.tint}`}>
                        <r.icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{r.title}</p>
                        <p className="text-xs text-slate-500">{r.text}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => { setOpenNotif(!openNotif); setOpenProfile(false); setOpenReport(false); }}
                    title="Notifications"
                    className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-100 ${openNotif ? "bg-slate-100 text-slate-900" : "text-slate-600"}`}
                    aria-label="Notifications"
                  >
                    <Bell className={`h-5 w-5 ${notifications.length > 0 ? "animate-wiggle origin-top" : ""}`} />
                    {notifications.length > 0 && (
                      <span className="animate-pulse-ring absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                        {notifications.length}
                      </span>
                    )}
                  </button>
                  {openNotif && (
                    <div className="animate-fade-down fixed inset-x-4 top-[4.25rem] origin-top-right overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
                      <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-white">
                        <div>
                          <p className="text-sm font-bold">Notifications</p>
                          <p className="text-[11px] text-blue-100">{notifications.length ? `${notifications.length} unread` : "Nothing new"}</p>
                        </div>
                        {notifications.length > 0 && (
                          <button onClick={markAllRead} className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/25">
                            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                          </button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                            <Bell className="h-7 w-7" />
                          </span>
                          <p className="mt-3 text-sm font-semibold text-slate-600">You are all caught up</p>
                          <p className="text-xs text-slate-400">New alerts will show up here.</p>
                        </div>
                      ) : (
                        <div className="scrollbar-thin max-h-96 overflow-y-auto p-2">
                          {notifications.map((n, i) => (
                            <button
                              key={n.id}
                              onClick={() => openNotification(n)}
                              style={{ animationDelay: `${i * 40}ms` }}
                              className="animate-fade-up flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50"
                            >
                              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.type === "new_comment" ? "bg-violet-50 text-violet-600" : "bg-brand-soft text-brand"}`}>
                                {n.type === "new_comment" ? <MessageSquare className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.message}</p>
                                <p className="mt-1 text-[11px] font-medium text-slate-400">{timeAgo(n.created_at)}</p>
                              </div>
                              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Profile */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => { setOpenProfile(!openProfile); setOpenNotif(false); setOpenReport(false); }}
                    className={`ml-1 flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-1 transition hover:shadow-card sm:pr-3 ${openProfile ? "border-brand ring-4 ring-blue-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <span className="relative">
                      <Avatar profile={profile} size="h-8 w-8" />
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                    </span>
                    <span className="hidden text-left leading-tight sm:block">
                      <span className="block text-sm font-bold text-slate-800">{firstName}</span>
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{isAdmin ? "Admin" : "Member"}</span>
                    </span>
                    <ChevronDown className={`hidden h-4 w-4 text-slate-400 transition-transform sm:block ${openProfile ? "rotate-180" : ""}`} />
                  </button>
                  {openProfile && (
                    <div className="animate-fade-down absolute right-0 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-pop">
                      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-950 p-4 text-white">
                        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-500/20" />
                        <div className="relative flex items-center gap-3">
                          <Avatar profile={profile} size="h-12 w-12" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{profile?.full_name || "Your account"}</p>
                            <p className="truncate text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        {[
                          { href: "/profile", icon: User, label: "My profile" },
                          { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
                        ].map((l) => (
                          <Link key={l.href} href={l.href} onClick={closeMenus} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                            <l.icon className="h-4 w-4 text-slate-400 transition group-hover:text-brand" /> {l.label}
                            <ChevronRight className="ml-auto h-4 w-4 text-slate-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                          </Link>
                        ))}
                        {isAdmin && (
                          <Link href="/admin" onClick={closeMenus} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50">
                            <Shield className="h-4 w-4" /> Admin panel
                          </Link>
                        )}
                        <div className="my-1 h-px bg-slate-100" />
                        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50">
                          <LogOut className="h-4 w-4" /> Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:block">Sign in</Link>
                <Link href="/register" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700">Get started</Link>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1">{children}</main>
        {/* Floating chats: "Message admin" sits above the Recovery Assistant.
            Hidden on /messages, which already shows the same conversation full-size. */}
        {pathname !== "/messages" && (
          <AdminChatWidget
            open={dock === "admin"}
            onOpenChange={(v) => setDock(v ? "admin" : null)}
            hideLauncher={dock === "assistant"}
            user={user}
            isAdmin={isAdmin}
            unread={unreadMessages}
          />
        )}
        <RecoveryAssistant
          open={dock === "assistant"}
          onOpenChange={(v) => setDock(v ? "assistant" : null)}
          hideLauncher={dock === "admin" && pathname !== "/messages"}
        />
      </div>
      {/* Quick search (Ctrl+K) */}
      {openSearch && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
          <div className="animate-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setOpenSearch(false)} />
          <div className="animate-scale-in relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-pop">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
                  if (e.key === "Enter" && results[activeIdx]) goTo(results[activeIdx].href);
                }}
                placeholder="Where do you want to go?"
                className="h-14 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Esc</kbd>
            </div>
            <div className="scrollbar-thin max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No pages match “{query}”</p>
              ) : (
                results.map((r, i) => (
                  <button
                    key={r.href}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => goTo(r.href)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${i === activeIdx ? "bg-brand-soft text-brand" : "text-slate-700"}`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${i === activeIdx ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}>
                      <r.icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 font-semibold">{r.label}</span>
                    <span className="text-[11px] text-slate-400">{r.group}</span>
                    {i === activeIdx && <CornerDownLeft className="h-4 w-4" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
