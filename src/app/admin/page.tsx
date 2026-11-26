"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowRight, ArrowUp, Ban, CheckCircle2, ChevronDown, ChevronsLeft, Clock, Compass,
  ExternalLink, Eye, Flag, Hand, LayoutDashboard, LogOut, Mail, Menu, MessageCircle, Package, Search,
  ShieldCheck, Star, Trash2, UserCheck, Users, X, XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notifyClaim } from "@/lib/notify";
import AdminInbox from "@/components/chat/AdminInbox";
import { CountUp } from "@/components/ui/Reveal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FlaggedReports from "@/components/admin/FlaggedReports";

// ── Types ──
type Item = {
  id: string;
  item_name: string;
  category: string;
  location: string;
  status: string;
  created_at: string;
  date_lost?: string;
  date_found?: string;
  image_urls?: string[] | null;
  image_url?: string | null;
};
type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  is_super_admin?: boolean;
  is_banned?: boolean;
  created_at?: string;
};
type ClaimItem = Pick<Item, "item_name" | "category" | "location" | "image_urls" | "image_url"> | null;
type ClaimUser = Pick<Profile, "id" | "full_name" | "email"> | null;
type Claim = {
  id: string;
  status: string;
  match_score: number;
  created_at: string;
  admin_notes: string | null;
  lost_item_id: string;
  found_item_id: string;
  lost_user_id: string;
  found_user_id: string;
  lost_item: ClaimItem;
  found_item: ClaimItem;
  lost_user: ClaimUser;
  found_user: ClaimUser;
};
type Tab = "overview" | "claims" | "lost" | "found" | "users" | "flagged" | "messages";
type UserActionKind = "promote" | "demote" | "ban" | "unban";

const USER_ACTION_META: Record<
  UserActionKind,
  { tone: "rose" | "amber" | "emerald" | "slate"; icon: typeof Ban; title: string; confirm: string; description: string; points: string[] }
> = {
  promote: {
    tone: "amber",
    icon: ShieldCheck,
    title: "Make this user an admin?",
    confirm: "Yes, make admin",
    description: "They will get full access to the admin panel.",
    points: [
      "Can verify claims and manage lost & found items",
      "Can read and reply to every user's private messages",
      "Can ban regular users",
    ],
  },
  demote: {
    tone: "slate",
    icon: UserCheck,
    title: "Remove admin access?",
    confirm: "Make regular user",
    description: "This admin will become a regular user again.",
    points: ["They lose access to the admin panel immediately", "Their reported items and messages stay as they are"],
  },
  ban: {
    tone: "rose",
    icon: Ban,
    title: "Ban this user?",
    confirm: "Yes, ban user",
    description: "Their account will be suspended until you restore it.",
    points: [
      "They will see a suspension message when they sign in",
      "They can no longer report items or send messages",
      "You can unban them at any time",
    ],
  },
  unban: {
    tone: "emerald",
    icon: CheckCircle2,
    title: "Restore this user's access?",
    confirm: "Yes, unban user",
    description: "The suspension will be lifted right away.",
    points: ["They can sign in and use the site normally again"],
  },
};

// Chart colours (validated: CVD-safe pair, labels/tooltips provide relief)
const LOST_COLOR = "#eb6834";
const FOUND_COLOR = "#1baf7a";
const BAR_COLOR = "#2a78d6";

const STATUS_STYLE: Record<string, string> = {
  recovered: "bg-emerald-100 text-emerald-700",
  matched: "bg-blue-100 text-blue-700",
  available: "bg-violet-100 text-violet-700",
  searching: "bg-amber-100 text-amber-700",
};

const CLAIM_META: Record<string, { label: string; style: string; icon: typeof Clock }> = {
  pending_verification: { label: "Pending", style: "bg-amber-100 text-amber-700", icon: Clock },
  approved: { label: "Approved", style: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", style: "bg-rose-100 text-rose-700", icon: XCircle },
};

const firstImage = (i: ClaimItem | Item) => i?.image_urls?.[0] || i?.image_url || "";

function Thumb({ src, kind, size = "h-10 w-10" }: { src: string; kind: "lost" | "found"; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-xl ${kind === "lost" ? "bg-rose-50 text-rose-400" : "bg-emerald-50 text-emerald-400"}`}>
      {kind === "lost" ? <Search className="h-4 w-4" /> : <Package className="h-4 w-4" />}
    </div>
  );
}

function UserAvatar({ user, size = "h-9 w-9" }: { user: Pick<Profile, "full_name" | "avatar_url">; size?: string }) {
  return user.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar_url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white`}>
      {user.full_name?.charAt(0).toUpperCase() || "U"}
    </span>
  );
}

function IconBtn({ onClick, title, tone = "slate", children }: { onClick: () => void; title: string; tone?: "slate" | "blue" | "rose" | "amber" | "emerald"; children: React.ReactNode }) {
  const tones = {
    slate: "hover:bg-slate-100 hover:text-slate-900",
    blue: "hover:bg-blue-50 hover:text-blue-600",
    rose: "hover:bg-rose-50 hover:text-rose-600",
    amber: "hover:bg-amber-50 hover:text-amber-600",
    emerald: "hover:bg-emerald-50 hover:text-emerald-600",
  };
  return (
    <button onClick={onClick} title={title} aria-label={title} className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition ${tones[tone]}`}>
      {children}
    </button>
  );
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [adminName, setAdminName] = useState("");
  const [lostItems, setLostItems] = useState<Item[]>([]);
  const [foundItems, setFoundItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyClaim, setBusyClaim] = useState("");
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [userAction, setUserAction] = useState<{ kind: UserActionKind; user: Profile } | null>(null);
  const [userActionBusy, setUserActionBusy] = useState(false);
  const [openFlags, setOpenFlags] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  // ── Load (admin check + data) ──
  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/admin-login");
      return null;
    }
    const { data: profile } = await supabase.from("profiles").select("role, is_super_admin, full_name").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") {
      router.push("/admin-login");
      return null;
    }
    const [lost, found, profiles, claimsData] = await Promise.all([
      supabase.from("lost_items").select("*").order("created_at", { ascending: false }),
      supabase.from("found_items").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("matches")
        .select(`
          *,
          lost_item:lost_items(item_name, category, location, image_urls, image_url),
          found_item:found_items(item_name, category, location, image_urls, image_url),
          lost_user:profiles!matches_lost_user_id_fkey(id, full_name, email),
          found_user:profiles!matches_found_user_id_fkey(id, full_name, email)
        `)
        .order("created_at", { ascending: false }),
    ]);
    return {
      userId: user.id,
      name: profile.full_name || "Admin",
      superAdmin: !!profile.is_super_admin,
      lost: (lost.data || []) as Item[],
      found: (found.data || []) as Item[],
      users: (profiles.data || []) as Profile[],
      claims: (claimsData.data || []) as Claim[],
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    loadAll().then((d) => {
      if (!d || cancelled) return;
      setCurrentUserId(d.userId);
      setAdminName(d.name);
      setIsSuperAdmin(d.superAdmin);
      setLostItems(d.lost);
      setFoundItems(d.found);
      setUsers(d.users);
      setClaims(d.claims);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Open-flag count for the sidebar badge; "#flag-..." links (from notifications) open the Flagged tab
  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("moderation_flags")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .then(({ count }) => {
        setOpenFlags(count || 0);
        if (window.location.hash.startsWith("#flag-")) setActiveTab("flagged");
      });
  }, [currentUserId]);

  const goTab = (tab: Tab) => {
    setActiveTab(tab);
    setSearch("");
    setStatusFilter("all");
    setMobileNav(false);
  };

  const openChatWith = (userId: string) => {
    setChatUserId(userId);
    goTab("messages");
  };

  // ── Actions ──
  const handleDelete = async (id: string, type: "lost" | "found") => {
    if (!window.confirm(`Delete this ${type} item?`)) return;
    const { error } = await supabase.from(type === "lost" ? "lost_items" : "found_items").delete().eq("id", id);
    if (error) return setToast({ ok: false, text: error.message });
    if (type === "lost") setLostItems((l) => l.filter((i) => i.id !== id));
    else setFoundItems((l) => l.filter((i) => i.id !== id));
    setToast({ ok: true, text: "Item deleted." });
  };

  const handleStatusChange = async (id: string, type: "lost" | "found", status: string) => {
    const { error } = await supabase.from(type === "lost" ? "lost_items" : "found_items").update({ status }).eq("id", id);
    if (error) return setToast({ ok: false, text: error.message });
    const upd = (l: Item[]) => l.map((i) => (i.id === id ? { ...i, status } : i));
    if (type === "lost") setLostItems(upd);
    else setFoundItems(upd);
  };

  const setRole = async (userId: string, role: "admin" | "student") => {
    const { error } = await supabase.rpc("update_user_role", { target_user_id: userId, new_role: role });
    if (error) return setToast({ ok: false, text: "Error: " + error.message });
    setUsers((u) => u.map((x) => (x.id === userId ? { ...x, role } : x)));
    setToast({ ok: true, text: role === "admin" ? "User promoted to admin." : "Admin changed to a regular user." });
  };

  const setBan = async (userId: string, ban: boolean) => {
    const { error } = await supabase.rpc("update_user_ban", { target_user_id: userId, ban_status: ban });
    if (error) return setToast({ ok: false, text: "Error: " + error.message });
    setUsers((u) => u.map((x) => (x.id === userId ? { ...x, is_banned: ban } : x)));
    setToast({ ok: true, text: ban ? "User banned." : "User access restored." });
  };

  const closeUserAction = useCallback(() => setUserAction(null), []);

  const runUserAction = async () => {
    if (!userAction || userActionBusy) return;
    const { kind, user } = userAction;
    setUserActionBusy(true);
    if (kind === "promote") await setRole(user.id, "admin");
    else if (kind === "demote") await setRole(user.id, "student");
    else await setBan(user.id, kind === "ban");
    setUserActionBusy(false);
    setUserAction(null);
  };

  const handleApproveClaim = async (claim: Claim) => {
    const note = notes[claim.id] || "";
    setBusyClaim(claim.id);
    const { error } = await supabase.from("matches").update({ status: "approved", admin_notes: note }).eq("id", claim.id);
    if (!error) {
      await supabase.from("lost_items").update({ status: "matched" }).eq("id", claim.lost_item_id);
      await supabase.from("found_items").update({ status: "matched" }).eq("id", claim.found_item_id);
      await notifyClaim("claim_approved", claim.id);
      setClaims((c) => c.map((x) => (x.id === claim.id ? { ...x, status: "approved", admin_notes: note } : x)));
      setToast({ ok: true, text: "Claim approved. Both users have been notified." });
    } else {
      setToast({ ok: false, text: error.message });
    }
    setBusyClaim("");
  };

  const handleRejectClaim = async (claim: Claim) => {
    const note = notes[claim.id] || "";
    setBusyClaim(claim.id);
    const { error } = await supabase.from("matches").update({ status: "rejected", admin_notes: note }).eq("id", claim.id);
    if (!error) {
      await notifyClaim("claim_rejected", claim.id);
      setClaims((c) => c.map((x) => (x.id === claim.id ? { ...x, status: "rejected", admin_notes: note } : x)));
      setToast({ ok: true, text: "Claim rejected. The user has been notified." });
    } else {
      setToast({ ok: false, text: error.message });
    }
    setBusyClaim("");
  };

  const handleEmailBothUsers = (claim: Claim) => {
    window.location.href = `mailto:${claim.lost_user?.email},${claim.found_user?.email}?subject=Lost and Found Item Match Verified&body=Dear Users,%0D%0A%0D%0AYour item match has been verified by admin. Please coordinate the handover at the admin office.%0D%0A%0D%0AItem: ${claim.lost_item?.item_name}%0D%0A%0D%0ARegards,%0D%0AAJK Lost and Found`;
  };

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin-login");
  };

  const canManageUser = (u: Profile) => {
    if (u.id === currentUserId) return false;
    if (u.is_super_admin) return false;
    if (!isSuperAdmin && u.role === "admin") return false;
    return true;
  };

  // ── Derived data ──
  const pendingClaims = claims.filter((c) => c.status === "pending_verification").length;
  const recovered = [...lostItems, ...foundItems].filter((i) => i.status === "recovered").length;

  const activity = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return { date: d, key: dayKey(d), lost: 0, found: 0 };
    });
    const idx = new Map(days.map((d, i) => [d.key, i]));
    lostItems.forEach((i) => {
      const k = idx.get(dayKey(new Date(i.created_at)));
      if (k !== undefined) days[k].lost++;
    });
    foundItems.forEach((i) => {
      const k = idx.get(dayKey(new Date(i.created_at)));
      if (k !== undefined) days[k].found++;
    });
    return days;
  }, [lostItems, foundItems]);
  const activityMax = Math.max(1, ...activity.map((d) => Math.max(d.lost, d.found)));
  const weekNow = activity.slice(7).reduce((s, d) => s + d.lost + d.found, 0);
  const weekBefore = activity.slice(0, 7).reduce((s, d) => s + d.lost + d.found, 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    [...lostItems, ...foundItems].forEach((i) => m.set(i.category || "other", (m.get(i.category || "other") || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [lostItems, foundItems]);
  const catMax = Math.max(1, ...byCategory.map(([, n]) => n));

  const q = search.trim().toLowerCase();
  const filterItems = (list: Item[]) =>
    list.filter(
      (i) =>
        (statusFilter === "all" || i.status === statusFilter) &&
        (!q || i.item_name?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q))
    );
  const filteredUsers = users.filter((u) => {
    const status = u.is_banned ? "banned" : u.role === "admin" ? "admin" : "user";
    return (statusFilter === "all" || status === statusFilter) && (!q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  });
  const filteredClaims = claims.filter(
    (c) =>
      (statusFilter === "all" || c.status === statusFilter) &&
      (!q ||
        c.lost_item?.item_name?.toLowerCase().includes(q) ||
        c.found_item?.item_name?.toLowerCase().includes(q) ||
        c.lost_user?.full_name?.toLowerCase().includes(q))
  );

  const NAV: { key: Tab; label: string; icon: typeof Users; count?: number; alert?: boolean }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "claims", label: "Claims", icon: Hand, count: pendingClaims, alert: pendingClaims > 0 },
    { key: "lost", label: "Lost items", icon: Search, count: lostItems.length },
    { key: "found", label: "Found items", icon: Package, count: foundItems.length },
    { key: "users", label: "Users", icon: Users, count: users.length },
    { key: "flagged", label: "Flagged", icon: Flag, count: openFlags, alert: openFlags > 0 },
    { key: "messages", label: "Messages", icon: MessageCircle },
  ];
  const TITLES: Record<Tab, string> = {
    overview: "Overview",
    claims: "Claim verification",
    lost: "Lost items",
    found: "Found items",
    users: "Users",
    flagged: "Flagged posts",
    messages: "Messages",
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-glow">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-500">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  // ── Pieces ──
  const sidebar = (mobile: boolean) => (
    <div className="flex h-full w-64 flex-col bg-sidebar text-slate-300">
      <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-white">Admin Console</p>
            <p className="text-[11px] text-slate-500">AJK Lost &amp; Found</p>
          </div>
        </div>
        <button
          onClick={() => (mobile ? setMobileNav(false) : setSidebarHidden(true))}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Hide sidebar"
        >
          {mobile ? <X className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">Manage</p>
        {NAV.map((n) => {
          const active = activeTab === n.key;
          return (
            <button
              key={n.key}
              onClick={() => goTab(n.key)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                active ? "bg-white/10 text-white" : "text-slate-400 hover:translate-x-0.5 hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-amber-400" />}
              <n.icon className={`h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110 ${active ? "text-amber-400" : ""}`} />
              <span className="flex-1 text-left">{n.label}</span>
              {n.count !== undefined && n.count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${n.alert ? "animate-pulse-ring bg-red-500 text-white" : "bg-white/10 text-slate-300"}`}>{n.count}</span>
              )}
            </button>
          );
        })}

        <p className="mb-2 mt-6 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">Website</p>
        <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-sidebar-hover hover:text-white">
          <Compass className="h-[18px] w-[18px]" /> Open public site
          <ExternalLink className="ml-auto h-3.5 w-3.5" />
        </Link>
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-white">
            {adminName.charAt(0).toUpperCase() || "A"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{adminName}</p>
            <p className="text-xs text-slate-500">{isSuperAdmin ? "Super admin" : "Admin"}</p>
          </div>
          <button onClick={handleAdminLogout} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/15 hover:text-red-400" title="Log out" aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const toolbar = (placeholder: string, filters: { key: string; label: string; count: number }[]) => (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none]">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
              statusFilter === f.key ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 text-[10px] ${statusFilter === f.key ? "bg-brand text-white" : "bg-slate-200 text-slate-600"}`}>{f.count}</span>
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-brand lg:w-72"
        />
      </div>
    </div>
  );

  const emptyRow = (cols: number, text: string) => (
    <tr>
      <td colSpan={cols} className="py-14 text-center text-sm text-slate-400">{text}</td>
    </tr>
  );

  const itemTable = (type: "lost" | "found") => {
    const all = type === "lost" ? lostItems : foundItems;
    const rows = filterItems(all);
    const statuses = type === "lost" ? ["searching", "matched", "recovered"] : ["available", "matched", "recovered"];
    return (
      <div className="animate-fade-up overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
        {toolbar("Search name, place, category…", [
          { key: "all", label: "All", count: all.length },
          ...statuses.map((s) => ({ key: s, label: s, count: all.filter((i) => i.status === s).length })),
        ])}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-slate-50/70 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Item</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">{type === "lost" ? "Date lost" : "Date found"}</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 && emptyRow(5, "No items match your filters.")}
              {rows.map((item, i) => (
                <tr key={item.id} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }} className="animate-fade-in transition hover:bg-slate-50/70">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb src={firstImage(item)} kind={type} />
                      <div className="min-w-0">
                        <p className="max-w-[220px] truncate font-semibold text-slate-900">{item.item_name}</p>
                        <p className="text-xs capitalize text-slate-500">{item.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[200px] truncate px-5 py-3 text-slate-600">{item.location}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{type === "lost" ? item.date_lost : item.date_found}</td>
                  <td className="px-5 py-3">
                    <div className="relative inline-block">
                      <select
                        value={item.status}
                        title="Change status"
                        onChange={(e) => handleStatusChange(item.id, type, e.target.value)}
                        className={`cursor-pointer appearance-none rounded-full py-1 pl-3 pr-7 text-xs font-bold capitalize outline-none ring-brand transition focus:ring-2 ${STATUS_STYLE[item.status] || STATUS_STYLE.searching}`}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 opacity-60" />
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <IconBtn onClick={() => router.push(`/item/${item.id}`)} title="View item" tone="blue"><Eye className="h-4 w-4" /></IconBtn>
                      <IconBtn onClick={() => handleDelete(item.id, type)} title="Delete item" tone="rose"><Trash2 className="h-4 w-4" /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden w-64 transition-transform duration-300 ease-out lg:block ${sidebarHidden ? "-translate-x-full" : "translate-x-0"}`} inert={sidebarHidden}>
        {sidebar(false)}
      </aside>

      {/* Mobile drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <aside className="animate-slide-in-left absolute inset-y-0 left-0 max-w-[85vw] shadow-2xl">{sidebar(true)}</aside>
        </div>
      )}

      <div className={`flex min-h-screen flex-col transition-[padding] duration-300 ease-out ${sidebarHidden ? "lg:pl-0" : "lg:pl-64"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => (window.matchMedia("(min-width: 1024px)").matches ? setSidebarHidden((v) => !v) : setMobileNav(true))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:text-brand active:scale-95"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div key={activeTab} className="animate-fade-in min-w-0 flex-1">
              <p className="hidden text-[11px] font-semibold text-slate-400 sm:block">Admin Console</p>
              <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">{TITLES[activeTab]}</h1>
            </div>

            {pendingClaims > 0 && activeTab !== "claims" && (
              <button
                onClick={() => goTab("claims")}
                className="hidden items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100 sm:flex"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                {pendingClaims} pending {pendingClaims === 1 ? "claim" : "claims"}
              </button>
            )}

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-1 transition sm:pr-3 ${isProfileOpen ? "border-brand ring-4 ring-blue-50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-white">
                  {adminName.charAt(0).toUpperCase() || "A"}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-bold text-slate-800">{adminName.split(" ")[0]}</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-amber-600">{isSuperAdmin ? "Super admin" : "Admin"}</span>
                </span>
                <ChevronDown className={`hidden h-4 w-4 text-slate-400 transition-transform sm:block ${isProfileOpen ? "rotate-180" : ""}`} />
              </button>
              {isProfileOpen && (
                <div className="animate-fade-down absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-pop">
                  <div className="mb-1 border-b border-slate-100 px-3 pb-3 pt-1">
                    <p className="text-sm font-bold text-slate-900">{adminName}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      {isSuperAdmin && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />} {isSuperAdmin ? "Super admin" : "Admin"}
                    </p>
                  </div>
                  <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <Compass className="h-4 w-4 text-slate-400" /> Open public site
                  </Link>
                  <button onClick={handleAdminLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main key={activeTab} className="animate-fade-up mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
          {/* ───────── OVERVIEW ───────── */}
          {activeTab === "overview" && (
            <>
              <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 p-6 text-white shadow-pop sm:p-8">
                <div className="animate-float absolute -right-10 -top-16 -z-10 h-64 w-64 rounded-full bg-blue-500/20" />
                <div className="animate-float absolute -bottom-20 right-1/3 -z-10 h-48 w-48 rounded-full bg-amber-400/10 [animation-delay:2s]" />
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-blue-200">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
                    <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Welcome back, {adminName.split(" ")[0]}</h2>
                    <p className="mt-1 text-sm text-slate-300">
                      {pendingClaims > 0 ? `You have ${pendingClaims} ${pendingClaims === 1 ? "claim" : "claims"} waiting for verification.` : "All claims are verified. Nice work!"}
                    </p>
                  </div>
                  <button
                    onClick={() => goTab("claims")}
                    className="group inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:-translate-y-0.5 md:self-auto"
                  >
                    <Hand className="h-4 w-4 text-amber-500" /> Review claims
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </section>

              {/* Stat tiles */}
              <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  { label: "Registered users", value: users.length, icon: Users, tint: "bg-blue-50 text-blue-600", tab: "users" as Tab },
                  { label: "Lost reports", value: lostItems.length, icon: Search, tint: "bg-rose-50 text-rose-500", tab: "lost" as Tab },
                  { label: "Found reports", value: foundItems.length, icon: Package, tint: "bg-emerald-50 text-emerald-600", tab: "found" as Tab },
                  { label: "Items recovered", value: recovered, icon: CheckCircle2, tint: "bg-violet-50 text-violet-600", tab: "lost" as Tab },
                ].map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => goTab(s.tab)}
                    style={{ animationDelay: `${i * 70}ms` }}
                    className="animate-fade-up card-hover flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-card"
                  >
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.tint}`}>
                      <s.icon className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-2xl font-extrabold text-slate-900"><CountUp value={s.value} duration={900} /></p>
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">{s.label}</p>
                    </div>
                  </button>
                ))}
              </section>

              <section className="grid gap-6 lg:grid-cols-3">
                {/* Activity chart */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card lg:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">New reports, last 14 days</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        This week: <strong className="text-slate-800">{weekNow}</strong>
                        {weekNow !== weekBefore && (
                          <span className={`inline-flex items-center font-semibold ${weekNow > weekBefore ? "text-emerald-600" : "text-rose-600"}`}>
                            {weekNow > weekBefore ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {Math.abs(weekNow - weekBefore)} vs last week
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: LOST_COLOR }} /> Lost</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: FOUND_COLOR }} /> Found</span>
                    </div>
                  </div>

                  <div className="relative mt-6 h-52" onMouseLeave={() => setHoverDay(null)}>
                    {/* gridlines */}
                    {[0, 0.5, 1].map((g) => (
                      <div key={g} className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ bottom: `${g * 100}%` }}>
                        <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] text-slate-400">{Math.round(activityMax * g)}</span>
                      </div>
                    ))}
                    <div className="absolute inset-0 flex items-end gap-1 pl-6 sm:gap-2">
                      {activity.map((d, i) => (
                        <div
                          key={d.key}
                          onMouseEnter={() => setHoverDay(i)}
                          className={`relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-md transition-colors ${hoverDay === i ? "bg-slate-50" : ""}`}
                        >
                          {[
                            { v: d.lost, c: LOST_COLOR },
                            { v: d.found, c: FOUND_COLOR },
                          ].map((b, j) => (
                            <div
                              key={j}
                              className="w-full max-w-[14px] origin-bottom rounded-t-[4px] transition-all duration-700 ease-out"
                              style={{ height: `${(b.v / activityMax) * 100}%`, minHeight: b.v ? 3 : 0, background: b.c, animation: `grow-y 0.8s ${i * 35}ms cubic-bezier(0.22,1,0.36,1) both` }}
                            />
                          ))}
                          {hoverDay === i && (
                            <div className="animate-fade-down pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-pop">
                              <p className="font-bold">{d.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                              <p className="mt-1 flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: LOST_COLOR }} /> Lost: {d.lost}</p>
                              <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: FOUND_COLOR }} /> Found: {d.found}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between pl-6 text-[10px] text-slate-400">
                    <span>{activity[0].date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                    <span>Today</span>
                  </div>
                  <style>{`@keyframes grow-y { from { transform: scaleY(0); } }`}</style>
                </div>

                {/* Category breakdown */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
                  <h3 className="font-bold text-slate-900">Reports by category</h3>
                  <p className="text-xs text-slate-500">Lost and found combined</p>
                  <ul className="mt-5 space-y-3.5">
                    {byCategory.length === 0 && <li className="py-8 text-center text-sm text-slate-400">No reports yet.</li>}
                    {byCategory.map(([cat, n], i) => (
                      <li key={cat} title={`${cat}: ${n} reports`}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-semibold capitalize text-slate-700">{cat}</span>
                          <span className="font-bold text-slate-900">{n}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full origin-left rounded-full"
                            style={{ width: `${(n / catMax) * 100}%`, background: BAR_COLOR, animation: `grow-x 0.9s ${i * 80}ms cubic-bezier(0.22,1,0.36,1) both` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <style>{`@keyframes grow-x { from { transform: scaleX(0); } }`}</style>
                </div>
              </section>

              {/* Recent */}
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-white shadow-card">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h3 className="font-bold text-slate-900">Latest claims</h3>
                    <button onClick={() => goTab("claims")} className="text-xs font-bold text-brand hover:underline">View all</button>
                  </div>
                  <ul className="divide-y divide-slate-50">
                    {claims.length === 0 && <li className="py-10 text-center text-sm text-slate-400">No claims yet.</li>}
                    {claims.slice(0, 5).map((c) => {
                      const meta = CLAIM_META[c.status] || CLAIM_META.pending_verification;
                      return (
                        <li key={c.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50/70">
                          <Thumb src={firstImage(c.found_item)} kind="found" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{c.lost_item?.item_name}</p>
                            <p className="truncate text-xs text-slate-500">by {c.lost_user?.full_name || "Unknown"} · {c.match_score}% match</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.style}`}>
                            <meta.icon className="h-3 w-3" /> {meta.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white shadow-card">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h3 className="font-bold text-slate-900">Newest users</h3>
                    <button onClick={() => goTab("users")} className="text-xs font-bold text-brand hover:underline">View all</button>
                  </div>
                  <ul className="divide-y divide-slate-50">
                    {users.slice(0, 5).map((u) => (
                      <li key={u.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50/70">
                        <UserAvatar user={u} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{u.full_name || "Unnamed"}</p>
                          <p className="truncate text-xs text-slate-500">{u.email}</p>
                        </div>
                        <span className="text-xs text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </>
          )}

          {/* ───────── CLAIMS ───────── */}
          {activeTab === "claims" && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
                {toolbar("Search item or claimant…", [
                  { key: "all", label: "All", count: claims.length },
                  { key: "pending_verification", label: "Pending", count: pendingClaims },
                  { key: "approved", label: "Approved", count: claims.filter((c) => c.status === "approved").length },
                  { key: "rejected", label: "Rejected", count: claims.filter((c) => c.status === "rejected").length },
                ])}
              </div>

              {filteredClaims.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
                  <Hand className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 font-bold text-slate-700">No claims here</p>
                  <p className="text-sm text-slate-500">Try another filter.</p>
                </div>
              )}

              {filteredClaims.map((claim, i) => {
                const meta = CLAIM_META[claim.status] || CLAIM_META.pending_verification;
                const pending = claim.status === "pending_verification";
                const score = claim.match_score;
                const scoreStyle = score >= 80 ? "text-emerald-600 bg-emerald-50" : score >= 50 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50";
                return (
                  <article
                    key={claim.id}
                    style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                    className={`animate-fade-up overflow-hidden rounded-2xl border bg-white shadow-card ${pending ? "border-amber-200" : "border-slate-100"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${meta.style}`}>
                          <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${scoreStyle}`}>{score}% match</span>
                      </div>
                      <p className="text-xs text-slate-400">Submitted {new Date(claim.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>

                    <div className="grid gap-4 p-5 lg:grid-cols-2">
                      {[
                        { label: "LOST ITEM", kind: "lost" as const, item: claim.lost_item, user: claim.lost_user, role: "Claimant (owner)" },
                        { label: "FOUND ITEM", kind: "found" as const, item: claim.found_item, user: claim.found_user, role: "Finder" },
                      ].map((side) => (
                        <div key={side.label} className={`rounded-xl p-4 ${side.kind === "lost" ? "bg-rose-50/60" : "bg-emerald-50/60"}`}>
                          <p className={`text-[10px] font-extrabold tracking-wide ${side.kind === "lost" ? "text-rose-500" : "text-emerald-600"}`}>{side.label}</p>
                          <div className="mt-2 flex items-center gap-3">
                            <Thumb src={firstImage(side.item)} kind={side.kind} size="h-14 w-14" />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900">{side.item?.item_name}</p>
                              <p className="truncate text-xs capitalize text-slate-500">{side.item?.category} · {side.item?.location}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase text-slate-400">{side.role}</p>
                              <p className="truncate text-sm font-semibold text-slate-800">{side.user?.full_name || "Unknown"}</p>
                              <p className="truncate text-xs text-slate-500">{side.user?.email}</p>
                            </div>
                            {side.user?.id && (
                              <button onClick={() => openChatWith(side.user!.id)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-bold text-brand transition hover:bg-blue-100">
                                <MessageCircle className="h-3.5 w-3.5" /> Message
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {pending ? (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Admin note (optional, sent to the users)</label>
                        <textarea
                          value={notes[claim.id] || ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [claim.id]: e.target.value }))}
                          placeholder="e.g. Please bring your CNIC to the Muzaffarabad office on Monday."
                          rows={2}
                          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-brand"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleApproveClaim(claim)}
                            disabled={busyClaim === claim.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" /> {busyClaim === claim.id ? "Working…" : "Approve & verify"}
                          </button>
                          <button
                            onClick={() => handleRejectClaim(claim)}
                            disabled={busyClaim === claim.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-60"
                          >
                            <XCircle className="h-4 w-4" /> Reject
                          </button>
                          <button
                            onClick={() => handleEmailBothUsers(claim)}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                          >
                            <Mail className="h-4 w-4" /> Email both users
                          </button>
                        </div>
                      </div>
                    ) : (
                      claim.admin_notes && (
                        <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-sm text-slate-600">
                          <strong className="text-slate-800">Admin note:</strong> {claim.admin_notes}
                        </p>
                      )
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* ───────── LOST / FOUND ───────── */}
          {activeTab === "lost" && itemTable("lost")}
          {activeTab === "found" && itemTable("found")}

          {/* ───────── USERS ───────── */}
          {activeTab === "users" && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              {toolbar("Search name or email…", [
                { key: "all", label: "All", count: users.length },
                { key: "user", label: "Users", count: users.filter((u) => u.role !== "admin" && !u.is_banned).length },
                { key: "admin", label: "Admins", count: users.filter((u) => u.role === "admin" && !u.is_banned).length },
                { key: "banned", label: "Banned", count: users.filter((u) => u.is_banned).length },
              ])}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Joined</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredUsers.length === 0 && emptyRow(5, "No users match your filters.")}
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }} className="animate-fade-in transition hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={u} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1 font-semibold text-slate-900">
                                {u.full_name || "Unnamed"}
                                {u.is_super_admin && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                                {u.id === currentUserId && <span className="rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">YOU</span>}
                              </p>
                              <p className="max-w-[240px] truncate text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${u.is_super_admin ? "bg-amber-100 text-amber-700" : u.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                            {u.is_super_admin ? "Super admin" : u.role === "admin" ? "Admin" : "User"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${u.is_banned ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${u.is_banned ? "bg-rose-500" : "bg-emerald-500"}`} />
                            {u.is_banned ? "Banned" : "Active"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            {u.role !== "admin" && (
                              <IconBtn onClick={() => openChatWith(u.id)} title="Send message" tone="blue"><MessageCircle className="h-4 w-4" /></IconBtn>
                            )}
                            {canManageUser(u) && (
                              <>
                                {u.role !== "admin" ? (
                                  <IconBtn onClick={() => setUserAction({ kind: "promote", user: u })} title="Make admin" tone="amber"><ShieldCheck className="h-4 w-4" /></IconBtn>
                                ) : (
                                  <IconBtn onClick={() => setUserAction({ kind: "demote", user: u })} title="Make regular user" tone="slate"><UserCheck className="h-4 w-4" /></IconBtn>
                                )}
                                {!u.is_banned ? (
                                  <IconBtn onClick={() => setUserAction({ kind: "ban", user: u })} title="Ban user" tone="rose"><Ban className="h-4 w-4" /></IconBtn>
                                ) : (
                                  <IconBtn onClick={() => setUserAction({ kind: "unban", user: u })} title="Unban user" tone="emerald"><CheckCircle2 className="h-4 w-4" /></IconBtn>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ───────── FLAGGED (scam / fake-report detection) ───────── */}
          {activeTab === "flagged" && (
            <FlaggedReports
              adminId={currentUserId}
              users={users}
              canBan={(id) => {
                const u = users.find((x) => x.id === id);
                return !!u && canManageUser(u);
              }}
              onBan={(id) => {
                const u = users.find((x) => x.id === id);
                if (u) setUserAction({ kind: "ban", user: u });
              }}
              onRemoved={(type, id) => {
                if (type === "lost") setLostItems((l) => l.filter((i) => i.id !== id));
                if (type === "found") setFoundItems((l) => l.filter((i) => i.id !== id));
              }}
              onOpenCount={setOpenFlags}
              onToast={setToast}
            />
          )}

          {/* ───────── MESSAGES ───────── */}
          {activeTab === "messages" && (
            <AdminInbox adminId={currentUserId} users={users} selectedUserId={chatUserId} onSelectUser={setChatUserId} />
          )}
        </main>
      </div>

      {/* User action confirmation (ban / unban / make admin / demote) */}
      {userAction && (() => {
        const meta = USER_ACTION_META[userAction.kind];
        const Icon = meta.icon;
        const u = userAction.user;
        return (
          <ConfirmDialog
            open
            tone={meta.tone}
            icon={<Icon className="h-8 w-8" />}
            title={meta.title}
            description={meta.description}
            points={meta.points}
            confirmLabel={meta.confirm}
            busy={userActionBusy}
            onConfirm={runUserAction}
            onClose={closeUserAction}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left">
              <UserAvatar user={u} size="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{u.full_name || "Unnamed user"}</p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${u.is_banned ? "bg-rose-100 text-rose-700" : u.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                {u.is_banned ? "Banned" : u.role === "admin" ? "Admin" : "User"}
              </span>
            </div>
          </ConfirmDialog>
        );
      })()}

      {/* Toast */}
      {toast && (
        <div className="animate-fade-up fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl bg-slate-900 px-5 py-4 text-sm text-white shadow-pop">
          {toast.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <XCircle className="h-5 w-5 shrink-0 text-rose-400" />}
          <p className="flex-1">{toast.text}</p>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
