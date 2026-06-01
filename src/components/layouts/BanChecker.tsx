"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";

export default function BanChecker() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkBanStatus();
  }, [pathname]);

  const checkBanStatus = async () => {
    if (pathname === "/banned" || pathname === "/login" || pathname === "/register") return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .single();

    if (profile?.is_banned) {
      router.push("/banned");
    }
  };

  return null;
}