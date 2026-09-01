"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function MatchesPage() {
  const router = useRouter();
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [selectedLostItem, setSelectedLostItem] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingItems, setFetchingItems] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState("");
  const [claimingId, setClaimingId] = useState("");
  const [claimedItems, setClaimedItems] = useState<string[]>([]);
  const [showClaimSuccess, setShowClaimSuccess] = useState(false);
  const [claimedItemName, setClaimedItemName] = useState("");

  useEffect(() => {
    fetchUserAndItems();
  }, []);

  const fetchUserAndItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUser(user);

    const { data: lost } = await supabase
      .from("lost_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "searching")
      .order("created_at", { ascending: false });

    const { data: existingMatches } = await supabase
      .from("matches")
      .select("found_item_id")
      .eq("lost_user_id", user.id);

    setClaimedItems(existingMatches?.map((m) => m.found_item_id) || []);
    setLostItems(lost || []);
    setFetchingItems(false);
  };

  const findMatches = async (lostItem: any) => {
    setSelectedLostItem(lostItem);
    setMatches([]);
    setError("");
    setLoading(true);

    const { data: foundItems } = await supabase
      .from("found_items")
      .select("*")
      .eq("status", "available");

    if (!foundItems || foundItems.length === 0) {
      setLoading(false);
      return;
    }

    const response = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lostItem, foundItems }),
    });

    const data = await response.json();
    const aiMatches = data.matches || [];

    const matchesWithDetails = aiMatches.map((match: any) => {
      const foundItem = foundItems.find((f) => f.id === match.id);
      return { ...match, foundItem };
    }).filter((m: any) => m.foundItem);

    setMatches(matchesWithDetails);
    setLoading(false);
  };

  const handleClaim = async (match: any) => {
    if (!user || !selectedLostItem) return;
    setClaimingId(match.id);

    // Get found item user
    const { data: foundItemData } = await supabase
      .from("found_items")
      .select("user_id")
      .eq("id", match.foundItem.id)
      .single();

    // Save match claim to database
    const { error } = await supabase.from("matches").insert({
      lost_item_id: selectedLostItem.id,
      found_item_id: match.foundItem.id,
      lost_user_id: user.id,
      found_user_id: foundItemData?.user_id,
      match_score: match.score,
      status: "pending_verification",
      claimed_by: user.id,
    });

    if (!error) {
      // Notify admin via API
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_claim",
          lostUserId: user.id,
          foundUserId: foundItemData?.user_id,
          userName: user.user_metadata?.full_name || "A student",  // ✅ added
          itemName: selectedLostItem?.item_name,                   // ✅ added — fixes "undefined"
        }),
      });

      setClaimedItems([...claimedItems, match.foundItem.id]);
      alert("✅ Claim submitted! Admin will verify and contact you soon.");
    } else {
      alert("Error submitting claim: " + error.message);
    }
    setClaimingId("");
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-700 bg-green-100 border-green-200";
    if (score >= 50) return "text-yellow-700 bg-yellow-100 border-yellow-200";
    return "text-red-700 bg-red-100 border-red-200";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "High Match";
    if (score >= 50) return "Possible Match";
    return "Low Match";
  };

  if (fetchingItems) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800">🤖 AI Match Finder</h1>
          <p className="text-gray-500 mt-2">
            Select your lost item and AI will find possible matches
          </p>
        </div>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-8">
          <h3 className="font-bold text-blue-800 mb-3">📋 How Claiming Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-blue-700">
            <div className="flex items-start gap-2">
              <span className="bg-blue-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
              <p>Find a match for your lost item</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
              <p>Click "Claim This Item" button</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
              <p>Admin verifies your claim</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">4</span>
              <p>Admin contacts both users for handover</p>
            </div>
          </div>
        </div>

        {/* Select Lost Item */}
        <div className="bg-white rounded-2xl shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Select Your Lost Item</h2>
          {lostItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-gray-400 mb-4">No lost items with searching status.</p>
              <button
                onClick={() => router.push("/report-lost")}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-full font-semibold transition"
              >
                Report Lost Item
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lostItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => findMatches(item)}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition ${selectedLostItem?.id === item.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {item.image_urls?.[0] || item.image_url ? (
                      <img src={item.image_urls?.[0] || item.image_url} alt={item.item_name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🔍</span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-800">{item.item_name}</h3>
                      <p className="text-sm text-gray-500">{item.category}</p>
                      <p className="text-sm text-gray-400">📍 {item.location}</p>
                    </div>
                    {selectedLostItem?.id === item.id && (
                      <span className="ml-auto text-blue-500 text-xl">✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow p-10 text-center mb-8">
            <div className="text-5xl mb-4 animate-bounce">🤖</div>
            <p className="text-gray-600 font-medium text-lg">Analyzing items...</p>
            <p className="text-gray-400 text-sm mt-2">Comparing descriptions, categories and locations...</p>
          </div>
        )}

        {/* Match Results */}
        {!loading && selectedLostItem && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Match Results for "{selectedLostItem.item_name}"
            </h2>

            {matches.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-10 text-center">
                <p className="text-5xl mb-4">😔</p>
                <p className="text-gray-500 text-lg">No matches found yet.</p>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                <p className="text-gray-400 text-sm mt-2">Keep checking as new found items are reported.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {matches.map((match, index) => (
                  <div key={index} className="bg-white rounded-2xl shadow p-6">
                    <div className="flex flex-col md:flex-row gap-6">

                      {/* Lost Item */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">YOUR LOST ITEM</span>
                        </div>
                        <div className="flex items-start gap-3">
                          {selectedLostItem.image_urls?.[0] || selectedLostItem.image_url ? (
                            <img src={selectedLostItem.image_urls?.[0] || selectedLostItem.image_url} alt={selectedLostItem.item_name} className="w-16 h-16 rounded-xl object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-red-100 flex items-center justify-center"><span className="text-2xl">🔍</span></div>
                          )}
                          <div>
                            <h3 className="font-bold text-gray-800">{selectedLostItem.item_name}</h3>
                            <p className="text-sm text-gray-500">{selectedLostItem.category}</p>
                            <p className="text-sm text-gray-400">📍 {selectedLostItem.location}</p>
                            <p className="text-sm text-gray-400">📅 {selectedLostItem.date_lost}</p>
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="flex flex-col items-center justify-center px-4">
                        <div className={`text-3xl font-bold px-6 py-3 rounded-2xl border-2 ${getScoreColor(match.score)}`}>
                          {match.score}%
                        </div>
                        <p className={`text-xs font-semibold mt-2 ${getScoreColor(match.score).split(" ")[0]}`}>
                          {getScoreLabel(match.score)}
                        </p>
                        <div className="text-2xl mt-2">🤖</div>
                      </div>

                      {/* Found Item */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">POSSIBLE MATCH</span>
                        </div>
                        <div className="flex items-start gap-3">
                          {match.foundItem?.image_urls?.[0] || match.foundItem?.image_url ? (
                            <img src={match.foundItem?.image_urls?.[0] || match.foundItem?.image_url} alt={match.foundItem?.item_name} className="w-16 h-16 rounded-xl object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-green-100 flex items-center justify-center"><span className="text-2xl">📦</span></div>
                          )}
                          <div>
                            <h3 className="font-bold text-gray-800">{match.foundItem?.item_name}</h3>
                            <p className="text-sm text-gray-500">{match.foundItem?.category}</p>
                            <p className="text-sm text-gray-400">📍 {match.foundItem?.location}</p>
                            <p className="text-sm text-gray-400">📅 {match.foundItem?.date_found}</p>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* AI Reason */}
                    <div className="mt-4 bg-blue-50 rounded-xl p-4">
                      <p className="text-sm text-blue-700">
                        <span className="font-semibold">🤖 Match Analysis: </span>
                        {match.reason}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 flex flex-col md:flex-row gap-3">
                      <button
                        onClick={() => router.push(`/item/${match.foundItem?.id}`)}
                        className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        👁 View Found Item
                      </button>

                      {claimedItems.includes(match.foundItem?.id) ? (
                        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-lg">
                          <span className="text-yellow-600 text-sm font-medium">⏳ Claim Submitted — Waiting for Admin Verification</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaim(match)}
                          disabled={claimingId === match.id}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                        >
                          {claimingId === match.id ? "Submitting..." : "✋ Claim This Item"}
                        </button>
                      )}
                    </div>

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