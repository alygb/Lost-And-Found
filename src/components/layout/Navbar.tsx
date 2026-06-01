"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    checkUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      fetchProfile(user.id);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
    fetchNotifications(userId);
  };

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifications(data || []);
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id);
    setNotifications([]);
    setShowNotifications(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsProfileOpen(false);
    router.push("/");
  };

  return (
    <nav className="bg-blue-700 text-white shadow-lg relative z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="text-xl font-bold tracking-wide">
          🎓 Lost & Found
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-yellow-300 transition">Home</Link>
          <Link href="/report-lost" className="hover:text-yellow-300 transition">Report Lost</Link>
          <Link href="/report-found" className="hover:text-yellow-300 transition">Report Found</Link>
          <Link href="/matches" className="hover:text-yellow-300 transition">Matches</Link>
          <Link href="/dashboard" className="hover:text-yellow-300 transition">Dashboard</Link>
        </div>

        {/* Auth Buttons or Profile */}
        {/* Auth Buttons or Profile */}
        <div className="hidden md:flex gap-3 items-center">
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative text-white hover:text-yellow-300 transition"
              >
                <span className="text-xl">🔔</span>
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-gray-800 rounded-2xl shadow-xl py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="font-bold text-gray-800">Notifications</p>
                    {notifications.length > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-700 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-gray-400 text-sm">No new notifications</p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="px-4 py-3 hover:bg-gray-50 border-b border-gray-50">
                          <p className="text-sm font-medium text-gray-800">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                          <p className="text-xs text-gray-300 mt-1">
                            {new Date(notif.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-full transition"
              >
                {profile?.avatar_url ? (
                  <img
                    src={`${profile.avatar_url}`}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                    key={profile.avatar_url}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-yellow-400 text-blue-900 flex items-center justify-center font-bold text-sm">
                    {profile?.full_name?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <span className="text-sm font-medium">
                  {profile?.full_name?.split(" ")[0] || "Profile"}
                </span>
                <span className="text-xs">▼</span>
              </button>

              {/* Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white text-gray-800 rounded-2xl shadow-xl py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-semibold text-gray-800">{profile?.full_name}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                    <p className="text-xs text-gray-400">{profile?.department}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-sm"
                  >
                    👤 My Profile
                  </Link>
                  
                  <Link
                    href="/dashboard"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-sm"
                  >
                    📊 Dashboard
                  </Link>
                  <Link
                    href="/report-lost"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-sm"
                  >
                    🔍 Report Lost Item
                  </Link>
                  <Link
                    href="/report-found"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-sm"
                  >
                    📦 Report Found Item
                  </Link>
                  <div className="border-t border-gray-100 mt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-red-500 transition text-sm w-full"
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="px-4 py-1.5 rounded-full border border-white hover:bg-white hover:text-blue-700 transition text-sm">
                Login
              </Link>
              <Link href="/register" className="px-4 py-1.5 rounded-full bg-yellow-400 text-blue-900 font-semibold hover:bg-yellow-300 transition text-sm">
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-blue-800 px-4 pb-4 flex flex-col gap-3 text-sm">
          <Link href="/" className="hover:text-yellow-300">Home</Link>
          <Link href="/report-lost" className="hover:text-yellow-300">Report Lost</Link>
          <Link href="/report-found" className="hover:text-yellow-300">Report Found</Link>
          <Link href="/matches" className="hover:text-yellow-300">Matches</Link>
          <Link href="/dashboard" className="hover:text-yellow-300">Dashboard</Link>
          {user ? (
            <>
              <Link href="/profile" className="hover:text-yellow-300">My Profile</Link>
              <button onClick={handleLogout} className="text-left text-red-300 hover:text-red-200">Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-yellow-300">Login</Link>
              <Link href="/register" className="hover:text-yellow-300">Register</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}