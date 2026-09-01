"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLost: 0,
    totalFound: 0,
    totalMatches: 0,
  });
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [foundItems, setFoundItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/admin-login"); return; }
    setCurrentUserId(user.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_super_admin, full_name")  // ← full_name added
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "admin") { router.push("/admin-login"); return; }
    setIsAdmin(true);
    setIsSuperAdmin(profile.is_super_admin || false);
    setAdminName(profile.full_name || "Admin");   // ← added
    fetchAllData();
  };

  const fetchAllData = async () => {
    const { data: lost } = await supabase.from("lost_items").select("*").order("created_at", { ascending: false });
    const { data: found } = await supabase.from("found_items").select("*").order("created_at", { ascending: false });
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: matches } = await supabase.from("matches").select("*");
    const { data: claimsData } = await supabase
      .from("matches")
      .select(`
        *,
        lost_item:lost_items(item_name, category, location, image_urls, image_url),
        found_item:found_items(item_name, category, location, image_urls, image_url),
        lost_user:profiles!matches_lost_user_id_fkey(full_name, email, department, semester),
        found_user:profiles!matches_found_user_id_fkey(full_name, email, department, semester)
      `)
      .order("created_at", { ascending: false });

    setLostItems(lost || []);
    setFoundItems(found || []);
    setUsers(profiles || []);
    setClaims(claimsData || []);
    setStats({
      totalUsers: profiles?.length || 0,
      totalLost: lost?.length || 0,
      totalFound: found?.length || 0,
      totalMatches: matches?.length || 0,
    });
    setLoading(false);
  };

  const handleDeleteLost = async (id: string) => {
    if (!window.confirm("Delete this lost item?")) return;
    const { error } = await supabase.from("lost_items").delete().eq("id", id);
    if (!error) setLostItems(lostItems.filter((i) => i.id !== id));
  };

  const handleDeleteFound = async (id: string) => {
    if (!window.confirm("Delete this found item?")) return;
    const { error } = await supabase.from("found_items").delete().eq("id", id);
    if (!error) setFoundItems(foundItems.filter((i) => i.id !== id));
  };

  const handleStatusChange = async (id: string, type: "lost" | "found", status: string) => {
    const table = type === "lost" ? "lost_items" : "found_items";
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (!error) {
      if (type === "lost") setLostItems(lostItems.map((i) => i.id === id ? { ...i, status } : i));
      else setFoundItems(foundItems.map((i) => i.id === id ? { ...i, status } : i));
    }
  };

  const handlePromoteToAdmin = async (userId: string) => {
    if (!window.confirm("Promote this user to Admin?")) return;
    const { error } = await supabase.rpc("update_user_role", { target_user_id: userId, new_role: "admin" });
    if (!error) setUsers(users.map((u) => u.id === userId ? { ...u, role: "admin" } : u));
    else alert("Error: " + error.message);
  };

  const handleDemoteToStudent = async (userId: string) => {
    if (!window.confirm("Demote this admin back to Student?")) return;
    const { error } = await supabase.rpc("update_user_role", { target_user_id: userId, new_role: "student" });
    if (!error) setUsers(users.map((u) => u.id === userId ? { ...u, role: "student" } : u));
    else alert("Error: " + error.message);
  };

  const handleBanUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Ban ${userName}? They will see a suspension message.`)) return;
    const { error } = await supabase.rpc("update_user_ban", { target_user_id: userId, ban_status: true });
    if (!error) setUsers(users.map((u) => u.id === userId ? { ...u, is_banned: true } : u));
    else alert("Error: " + error.message);
  };

  const handleUnbanUser = async (userId: string) => {
    if (!window.confirm("Restore this user's access?")) return;
    const { error } = await supabase.rpc("update_user_ban", { target_user_id: userId, ban_status: false });
    if (!error) setUsers(users.map((u) => u.id === userId ? { ...u, is_banned: false } : u));
    else alert("Error: " + error.message);
  };

  // ✅ FIXED — was sending wrong type before
  const handleApproveClaim = async (claim: any) => {
    const notes = (document.getElementById(`notes-${claim.id}`) as HTMLTextAreaElement)?.value;
    const { error } = await supabase.from("matches").update({ status: "approved", admin_notes: notes }).eq("id", claim.id);
    if (!error) {
      await supabase.from("lost_items").update({ status: "matched" }).eq("id", claim.lost_item_id);
      await supabase.from("found_items").update({ status: "matched" }).eq("id", claim.found_item_id);

      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "claim_approved",                        // ✅ fixed
          lostUserId: claim.lost_user_id,
          foundUserId: claim.found_user_id,              // ✅ added
          userEmail: claim.lost_user?.email,
          userName: claim.lost_user?.full_name,
          finderEmail: claim.found_user?.email,          // ✅ added
          finderName: claim.found_user?.full_name,       // ✅ added
          itemName: claim.lost_item?.item_name,
          adminNote: notes || "Please bring your University ID card.",
        }),
      });

      setClaims(claims.map(c => c.id === claim.id ? { ...c, status: "approved" } : c));
      alert("✅ Claim approved! Both users have been notified.");
    }
  };

  // ✅ FIXED — was sending wrong type before
  const handleRejectClaim = async (claim: any) => {
    const notes = (document.getElementById(`notes-${claim.id}`) as HTMLTextAreaElement)?.value;
    const { error } = await supabase.from("matches").update({ status: "rejected", admin_notes: notes }).eq("id", claim.id);
    if (!error) {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "claim_rejected",                        // ✅ fixed
          lostUserId: claim.lost_user_id,
          userEmail: claim.lost_user?.email,
          userName: claim.lost_user?.full_name,
          itemName: claim.lost_item?.item_name,
          adminNote: notes || "No note provided",
        }),
      });

      setClaims(claims.map(c => c.id === claim.id ? { ...c, status: "rejected" } : c));
      alert("❌ Claim rejected. User has been notified.");
    }
  };

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin-login");
  };



  const handleEmailBothUsers = (claim: any) => {
    const email1 = claim.lost_user?.email;
    const email2 = claim.found_user?.email;
    window.location.href = `mailto:${email1},${email2}?subject=Lost and Found Item Match Verified&body=Dear Students,%0D%0A%0D%0AYour item match has been verified by admin. Please coordinate to hand over the item.%0D%0A%0D%0AItem: ${claim.lost_item?.item_name}%0D%0A%0D%0ARegards,%0D%0AUniversity Lost and Found System`;
  };



  const canManageUser = (targetUser: any) => {
    if (targetUser.id === currentUserId) return false;
    if (targetUser.is_super_admin) return false;
    if (!isSuperAdmin && targetUser.role === "admin") return false;
    return true;
  };

  const getStatusColor = (status: string) => {
    if (status === "recovered") return "text-green-700 bg-green-100";
    if (status === "matched") return "text-blue-700 bg-blue-100";
    if (status === "available") return "text-purple-700 bg-purple-100";
    return "text-yellow-700 bg-yellow-100";
  };

  const filteredLost = lostItems.filter((i) =>
    i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.location?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredFound = foundItems.filter((i) =>
    i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.location?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredUsers = users.filter((u) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())  // ✅ search by department too
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading admin panel...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Admin Header */}

      <div className="bg-blue-900 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-blue-300 text-sm">Lost & Found Management System</p>
          </div>

          {/* Admin Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 px-3 py-2 rounded-full transition"
            >
              <div className="w-8 h-8 rounded-full bg-yellow-400 text-blue-900 flex items-center justify-center font-bold text-sm">
                {adminName?.charAt(0).toUpperCase() || "A"}
              </div>
              <span className="text-sm font-medium">{adminName || "Admin"}</span>
              <span className="text-xs">▼</span>
            </button>

            {/* Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-2xl shadow-xl py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-800">{adminName}</p>
                  <p className="text-xs text-gray-400">
                    {isSuperAdmin ? "⭐ Super Admin" : "Admin"}
                  </p>
                </div>
                <button
                  onClick={handleAdminLogout}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-red-500 transition text-sm w-full"
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          {["overview", "lost", "found", "users", "claims"].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearch(""); }}
              className={`py-4 text-sm font-medium border-b-2 transition capitalize whitespace-nowrap ${activeTab === tab ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {tab === "overview" && "📊 "}
              {tab === "lost" && "🔍 "}
              {tab === "found" && "📦 "}
              {tab === "users" && "👥 "}
              {tab === "claims" && "✋ "}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "lost" && ` (${lostItems.length})`}
              {tab === "found" && ` (${foundItems.length})`}
              {tab === "users" && ` (${users.length})`}
              {tab === "claims" && ` (${claims.filter(c => c.status === "pending_verification").length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-3xl font-bold text-blue-700">{stats.totalUsers}</p>
                <p className="text-gray-500 text-sm mt-1">Total Users</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-3xl font-bold text-red-500">{stats.totalLost}</p>
                <p className="text-gray-500 text-sm mt-1">Lost Items</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-3xl font-bold text-green-600">{stats.totalFound}</p>
                <p className="text-gray-500 text-sm mt-1">Found Items</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-3xl font-bold text-yellow-500">{stats.totalMatches}</p>
                <p className="text-gray-500 text-sm mt-1">AI Matches</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Lost Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Item</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Location</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lostItems.slice(0, 5).map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-800">{item.item_name}</td>
                        <td className="py-3 px-4 text-gray-500">{item.location}</td>
                        <td className="py-3 px-4 text-gray-500">{item.date_lost}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(item.status)}`}>{item.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Users</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Department</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Semester</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 5).map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-800">{user.full_name}</td>
                        <td className="py-3 px-4 text-gray-500">{user.email}</td>
                        {/* ✅ department now shows with fallback */}
                        <td className="py-3 px-4 text-gray-500">{user.department || "—"}</td>
                        <td className="py-3 px-4 text-gray-500">
                          {user.semester ? `${user.semester} Semester` : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.is_super_admin ? "bg-yellow-100 text-yellow-700" : user.role === "admin" ? "bg-blue-100 text-blue-700" : user.is_banned ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                            {user.is_super_admin ? "⭐ Super Admin" : user.role === "admin" ? "Admin" : user.is_banned ? "Banned" : "Student"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── LOST ITEMS TAB ── */}
        {activeTab === "lost" && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">All Lost Items</h2>
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Image</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Item</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Category</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Location</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLost.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {item.image_urls?.[0] || item.image_url ? (
                          <img src={item.image_urls?.[0] || item.image_url} alt={item.item_name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">🔍</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-800">{item.item_name}</td>
                      <td className="py-3 px-4 text-gray-500">{item.category}</td>
                      <td className="py-3 px-4 text-gray-500">{item.location}</td>
                      <td className="py-3 px-4 text-gray-500">{item.date_lost}</td>
                      <td className="py-3 px-4">
                        <select value={item.status} title="status" onChange={(e) => handleStatusChange(item.id, "lost", e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none">
                          <option value="searching">Searching</option>
                          <option value="matched">Matched</option>
                          <option value="recovered">Recovered</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button onClick={() => router.push(`/item/${item.id}`)} className="text-blue-700 hover:underline text-xs font-medium">View</button>
                          <button onClick={() => handleDeleteLost(item.id)} className="text-red-500 hover:underline text-xs font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── FOUND ITEMS TAB ── */}
        {activeTab === "found" && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">All Found Items</h2>
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Image</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Item</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Category</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Location</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFound.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {item.image_urls?.[0] || item.image_url ? (
                          <img src={item.image_urls?.[0] || item.image_url} alt={item.item_name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">📦</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-800">{item.item_name}</td>
                      <td className="py-3 px-4 text-gray-500">{item.category}</td>
                      <td className="py-3 px-4 text-gray-500">{item.location}</td>
                      <td className="py-3 px-4 text-gray-500">{item.date_found}</td>
                      <td className="py-3 px-4">
                        <select value={item.status} title="status" onChange={(e) => handleStatusChange(item.id, "found", e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none">
                          <option value="available">Available</option>
                          <option value="matched">Matched</option>
                          <option value="recovered">Recovered</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button onClick={() => router.push(`/item/${item.id}`)} className="text-blue-700 hover:underline text-xs font-medium">View</button>
                          <button onClick={() => handleDeleteFound(item.id)} className="text-red-500 hover:underline text-xs font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {activeTab === "users" && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">All Users</h2>
              <input type="text" placeholder="Search by name, email, department..." value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">User</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Email</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Department</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Semester</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Role</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.full_name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs">
                              {user.full_name?.charAt(0).toUpperCase() || "U"}
                            </div>
                          )}
                          <span className="font-medium text-gray-800">{user.full_name}</span>
                          {user.is_super_admin && <span className="text-yellow-500">⭐</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{user.email}</td>
                      {/* ✅ department and semester now show with fallback */}
                      <td className="py-3 px-4 text-gray-500">{user.department || "—"}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {user.semester ? `${user.semester} Semester` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.is_super_admin ? "bg-yellow-100 text-yellow-700" : user.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                          {user.is_super_admin ? "⭐ Super Admin" : user.role === "admin" ? "Admin" : "Student"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.is_banned ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {user.is_banned ? "Banned" : "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {canManageUser(user) ? (
                          <div className="flex flex-col gap-1">
                            {user.role !== "admin" ? (
                              <button onClick={() => handlePromoteToAdmin(user.id)} className="text-blue-700 hover:underline text-xs font-medium text-left">⬆ Make Admin</button>
                            ) : (
                              <button onClick={() => handleDemoteToStudent(user.id)} className="text-yellow-600 hover:underline text-xs font-medium text-left">⬇ Make Student</button>
                            )}
                            {!user.is_banned ? (
                              <button onClick={() => handleBanUser(user.id, user.full_name)} className="text-red-500 hover:underline text-xs font-medium text-left">🚫 Ban User</button>
                            ) : (
                              <button onClick={() => handleUnbanUser(user.id)} className="text-green-600 hover:underline text-xs font-medium text-left">✅ Unban User</button>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CLAIMS TAB ── */}
        {activeTab === "claims" && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Item Claims</h2>
                <p className="text-gray-500 text-sm mt-1">Verify and approve item claims from students</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  {claims.filter(c => c.status === "pending_verification").length} Pending
                </span>
                <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  {claims.filter(c => c.status === "approved").length} Approved
                </span>
              </div>
            </div>

            {claims.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-5xl mb-4">✋</p>
                <p className="text-gray-400">No claims submitted yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {claims.map((claim) => (
                  <div key={claim.id} className="border border-gray-200 rounded-xl p-5">

                    {/* Match Score + Status */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold px-4 py-1.5 rounded-xl border-2 ${claim.match_score >= 80 ? "text-green-700 bg-green-100 border-green-200" : claim.match_score >= 50 ? "text-yellow-700 bg-yellow-100 border-yellow-200" : "text-red-700 bg-red-100 border-red-200"}`}>
                          {claim.match_score}% Match
                        </span>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${claim.status === "approved" ? "bg-green-100 text-green-700" : claim.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {claim.status === "pending_verification" ? "⏳ Pending Verification" : claim.status === "approved" ? "✅ Approved" : claim.status === "rejected" ? "❌ Rejected" : claim.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{new Date(claim.created_at).toLocaleDateString()}</p>
                    </div>

                    {/* Items */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-red-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-red-700 mb-2">LOST ITEM</p>
                        <div className="flex items-center gap-3">
                          {claim.lost_item?.image_urls?.[0] || claim.lost_item?.image_url ? (
                            <img src={claim.lost_item?.image_urls?.[0] || claim.lost_item?.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">🔍</div>
                          )}
                          <div>
                            <p className="font-bold text-gray-800">{claim.lost_item?.item_name}</p>
                            <p className="text-xs text-gray-500">{claim.lost_item?.category}</p>
                            <p className="text-xs text-gray-400">📍 {claim.lost_item?.location}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-green-700 mb-2">FOUND ITEM</p>
                        <div className="flex items-center gap-3">
                          {claim.found_item?.image_urls?.[0] || claim.found_item?.image_url ? (
                            <img src={claim.found_item?.image_urls?.[0] || claim.found_item?.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">📦</div>
                          )}
                          <div>
                            <p className="font-bold text-gray-800">{claim.found_item?.item_name}</p>
                            <p className="text-xs text-gray-500">{claim.found_item?.category}</p>
                            <p className="text-xs text-gray-400">📍 {claim.found_item?.location}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Users — now shows department + semester */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-500 mb-1">CLAIMANT (Lost Item Owner)</p>
                        <p className="font-medium text-gray-800">{claim.lost_user?.full_name}</p>
                        <p className="text-xs text-gray-500">{claim.lost_user?.email}</p>
                        <p className="text-xs text-gray-400">{claim.lost_user?.department || "—"}</p>
                        <p className="text-xs text-gray-400">
                          {claim.lost_user?.semester ? `Semester ${claim.lost_user.semester}` : ""}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-500 mb-1">FINDER (Found Item Owner)</p>
                        <p className="font-medium text-gray-800">{claim.found_user?.full_name}</p>
                        <p className="text-xs text-gray-500">{claim.found_user?.email}</p>
                        <p className="text-xs text-gray-400">{claim.found_user?.department || "—"}</p>
                        <p className="text-xs text-gray-400">
                          {claim.found_user?.semester ? `Semester ${claim.found_user.semester}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Admin Notes */}
                    {claim.status === "pending_verification" && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (optional)</label>
                        <textarea
                          id={`notes-${claim.id}`}
                          placeholder="Add verification notes..."
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    {claim.status === "pending_verification" && (
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => handleApproveClaim(claim)} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition">
                          ✅ Approve & Verify
                        </button>
                        <button onClick={() => handleRejectClaim(claim)} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition">
                          ❌ Reject Claim
                        </button>
                        <button onClick={() => handleEmailBothUsers(claim)} className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition">
                          📧 Email Both Users
                        </button>
                      </div>
                    )}

                    {/* Show admin notes if already processed */}
                    {claim.admin_notes && claim.status !== "pending_verification" && (
                      <div className="bg-gray-50 rounded-xl p-3 mt-3">
                        <p className="text-xs font-bold text-gray-500 mb-1">ADMIN NOTES</p>
                        <p className="text-sm text-gray-700">{claim.admin_notes}</p>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}