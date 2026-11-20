"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell, ChevronDown, Compass, LayoutDashboard, LogOut, Menu, User, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/report-lost", label: "Report Lost" },
  { href: "/report-found", label: "Report Found" },
  { href: "/matches", label: "Matches" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [openNotif, setOpenNotif] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async (uid: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,avatar_url,department")
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
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Close menus on route change
  useEffect(() => {
    setOpenNotif(false);
    setOpenProfile(false);
    setOpenMobile(false);
  }, [pathname]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setOpenNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setOpenProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
    setNotifications([]);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setOpenProfile(false);
    router.push("/");
  };

  // Login and register have their own full-screen layouts
  if (pathname === "/login" || pathname === "/register") return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const initial = profile?.full_name?.charAt(0).toUpperCase() || "U";
  const firstName = profile?.full_name?.split(" ")[0] || "Account";

  const Avatar = ({ size = "h-9 w-9" }: { size?: string }) =>
    profile?.avatar_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatar_url} alt="" className={`${size} rounded-full object-cover`} />
    ) : (
      <span className={`${size} flex items-center justify-center rounded-full bg-brand text-sm font-bold text-white`}>
        {initial}
      </span>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-card">
            <Compass className="h-5 w-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            AJK <span className="text-brand">Lost &amp; Found</span>
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive(l.href)
                  ? "bg-brand-soft text-brand"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => {
                    setOpenNotif(!openNotif);
                    setOpenProfile(false);
                  }}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {openNotif && (
                  <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-pop">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-bold text-slate-900">Notifications</p>
                      {notifications.length > 0 && (
                        <button onClick={markAllRead} className="text-xs font-semibold text-brand hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-400">
                        You are all caught up
                      </p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.map((n) => (
                          <div key={n.id} className="border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50">
                            <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.message}</p>
                            <p className="mt-1 text-[11px] text-slate-300">
                              {new Date(n.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => {
                    setOpenProfile(!openProfile);
                    setOpenNotif(false);
                  }}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 transition hover:bg-slate-50"
                >
                  <Avatar />
                  <span className="hidden text-sm font-semibold text-slate-700 sm:block">
                    {firstName}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
                </button>

                {openProfile && (
                  <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-pop">
                    <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                      <Avatar size="h-11 w-11" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{profile?.full_name}</p>
                        <p className="truncate text-xs text-slate-400">{user.email}</p>
                        {profile?.department && (
                          <p className="truncate text-xs text-slate-400">{profile.department}</p>
                        )}
                      </div>
                    </div>
                    <div className="p-2">
                      <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <User className="h-4 w-4 text-slate-400" /> My profile
                      </Link>
                      <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <LayoutDashboard className="h-4 w-4 text-slate-400" /> Dashboard
                      </Link>
                      <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Sign in
              </Link>
              <Link href="/register" className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white shadow-card transition hover:bg-brand-dark">
                Get started
              </Link>
            </div>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setOpenMobile(!openMobile)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label="Menu"
          >
            {openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {openMobile && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`block rounded-xl px-4 py-3 text-sm font-semibold ${
                isActive(l.href) ? "bg-brand-soft text-brand" : "text-slate-700"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {!user && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Link href="/login" className="rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700">
                Sign in
              </Link>
              <Link href="/register" className="rounded-xl bg-brand py-3 text-center text-sm font-bold text-white">
                Get started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}