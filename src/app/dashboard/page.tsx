"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [foundItems, setFoundItems] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [finderClaims, setFinderClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editType, setEditType] = useState<"lost" | "found">("lost");
  const [editLoading, setEditLoading] = useState(false);
  const [editImages, setEditImages] = useState<File[]>([]);
  const [editPreviews, setEditPreviews] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile) setUserName(profile.full_name);

    const { data: lost } = await supabase
      .from("lost_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const { data: found } = await supabase
      .from("found_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Claims where user is the OWNER (lost item)
    const { data: claimsData } = await supabase
      .from("matches")
      .select(`
        *,
        lost_item:lost_items(item_name, category, location, image_urls, image_url),
        found_item:found_items(item_name, category, location, image_urls, image_url)
      `)
      .eq("lost_user_id", user.id)
      .order("created_at", { ascending: false });

    // Claims where user is the FINDER (found item) — to show submit to admin notice
    const { data: finderClaimsData } = await supabase
      .from("matches")
      .select(`
        *,
        lost_item:lost_items(item_name, category, location, image_urls, image_url),
        found_item:found_items(item_name, category, location, image_urls, image_url)
      `)
      .eq("found_user_id", user.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    setLostItems(lost || []);
    setFoundItems(found || []);
    setClaims(claimsData || []);
    setFinderClaims(finderClaimsData || []);
    setLoading(false);
  };

  const handleDelete = async (id: string, type: "lost" | "found") => {
    const confirm = window.confirm("Are you sure you want to delete this item?");
    if (!confirm) return;
    const table = type === "lost" ? "lost_items" : "found_items";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (!error) {
      if (type === "lost") setLostItems(lostItems.filter((i) => i.id !== id));
      else setFoundItems(foundItems.filter((i) => i.id !== id));
    }
  };

  const handleEditOpen = (item: any, type: "lost" | "found") => {
    setEditItem({ ...item });
    setEditType(type);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setEditItem({ ...editItem, [e.target.name]: e.target.value });
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 5) { alert("Maximum 5 images!"); return; }
    setEditImages(files);
    setEditPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const removeEditImage = (index: number) => {
    const newUrls = editItem.image_urls.filter((_: string, i: number) => i !== index);
    setEditItem({ ...editItem, image_urls: newUrls });
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    const table = editType === "lost" ? "lost_items" : "found_items";
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let imageUrls = editItem.image_urls || [];

    if (editImages.length > 0) {
      const newUrls: string[] = [];
      for (const image of editImages) {
        const fileExt = image.name.split(".").pop();
        const fileName = `${user.id}-${Date.now()}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("item-images").upload(fileName, image);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("item-images").getPublicUrl(fileName);
          newUrls.push(urlData.publicUrl);
        }
      }
      imageUrls = [...imageUrls, ...newUrls];
    }

    const updateData = editType === "lost" ? {
      item_name: editItem.item_name, category: editItem.category,
      description: editItem.description, location: editItem.location,
      date_lost: editItem.date_lost, contact_email: editItem.contact_email,
      contact_phone: editItem.contact_phone, image_urls: imageUrls, image_url: imageUrls[0] || "",
    } : {
      item_name: editItem.item_name, category: editItem.category,
      description: editItem.description, location: editItem.location,
      date_found: editItem.date_found, contact_email: editItem.contact_email,
      contact_phone: editItem.contact_phone, image_urls: imageUrls, image_url: imageUrls[0] || "",
    };

    const { error } = await supabase.from(table).update(updateData).eq("id", editItem.id);
    if (!error) {
      await fetchData();
      setEditItem(null);
      setEditImages([]);
      setEditPreviews([]);
    }
    setEditLoading(false);
  };

  const getStatusColor = (status: string) => {
    if (status === "recovered") return "text-green-700 bg-green-100";
    if (status === "matched") return "text-blue-700 bg-blue-100";
    return "text-yellow-700 bg-yellow-100";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">My Dashboard</h1>
            <p className="text-gray-500 mt-1">Welcome back, {userName}!</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow p-5 text-center">
            <p className="text-3xl font-bold text-blue-700">{lostItems.length + foundItems.length}</p>
            <p className="text-gray-500 text-sm mt-1">Total Reports</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5 text-center">
            <p className="text-3xl font-bold text-red-500">{lostItems.length}</p>
            <p className="text-gray-500 text-sm mt-1">Lost Items</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5 text-center">
            <p className="text-3xl font-bold text-green-600">{foundItems.length}</p>
            <p className="text-gray-500 text-sm mt-1">Found Items</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/report-lost" className="bg-red-500 hover:bg-red-600 text-white rounded-xl p-6 flex items-center gap-4 transition">
            <div className="text-4xl">🔍</div>
            <div>
              <p className="font-bold text-lg">Report Lost Item</p>
              <p className="text-red-100 text-sm">Submit a new lost item report</p>
            </div>
          </Link>
          <Link href="/report-found" className="bg-green-500 hover:bg-green-600 text-white rounded-xl p-6 flex items-center gap-4 transition">
            <div className="text-4xl">📦</div>
            <div>
              <p className="font-bold text-lg">Report Found Item</p>
              <p className="text-green-100 text-sm">Submit a new found item report</p>
            </div>
          </Link>
        </div>

        {/* ── FINDER ALERT — Submit to Admin Office ── */}
        {finderClaims.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">📦</span>
              <div>
                <h2 className="text-lg font-bold text-orange-800">Action Required — Submit Item to Admin Office</h2>
                <p className="text-orange-600 text-sm">The following items you found have been claimed and verified. Please submit them to the Admin Office.</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {finderClaims.map((claim) => (
                <div key={claim.id} className="bg-white border border-orange-200 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    {claim.found_item?.image_urls?.[0] || claim.found_item?.image_url ? (
                      <img src={claim.found_item?.image_urls?.[0] || claim.found_item?.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 text-2xl">📦</div>
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{claim.found_item?.item_name}</p>
                      <p className="text-xs text-gray-500">{claim.found_item?.category} • {claim.found_item?.location}</p>
                    </div>
                  </div>
                  <div className="mt-3 bg-orange-50 rounded-lg p-3">
                    <p className="text-orange-800 text-sm font-bold">📍 Next Step:</p>
                    <p className="text-orange-700 text-sm mt-1">
                      Please bring this item to the <strong>Admin Office</strong> within <strong>2 days</strong>.
                      The owner will collect it from there.
                    </p>
                    <p className="text-orange-600 text-xs mt-2">
                      ⚠️ Do NOT hand the item directly to the owner. Submit to admin only.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lost Items */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">My Lost Items</h2>
          {lostItems.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No lost items reported yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {lostItems.map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {item.image_urls && item.image_urls.length > 0 ? (
                        <img src={item.image_urls[0]} alt={item.item_name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : item.image_url ? (
                        <img src={item.image_url} alt={item.item_name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">🔍</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{item.item_name}</h3>
                        <p className="text-sm text-gray-500">{item.category} • {item.location}</p>
                        <p className="text-sm text-gray-400">{item.date_lost}</p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">{item.description}</p>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full mt-2 inline-block ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => router.push(`/item/${item.id}`)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-lg transition">👁 View</button>
                      <button onClick={() => handleEditOpen(item, "lost")} className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-medium px-3 py-1.5 rounded-lg transition">✏️ Edit</button>
                      <button onClick={() => handleDelete(item.id, "lost")} className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium px-3 py-1.5 rounded-lg transition">🗑 Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Found Items */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">My Found Items</h2>
          {foundItems.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No found items reported yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {foundItems.map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {item.image_urls && item.image_urls.length > 0 ? (
                        <img src={item.image_urls[0]} alt={item.item_name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : item.image_url ? (
                        <img src={item.image_url} alt={item.item_name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">📦</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{item.item_name}</h3>
                        <p className="text-sm text-gray-500">{item.category} • {item.location}</p>
                        <p className="text-sm text-gray-400">{item.date_found}</p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">{item.description}</p>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full mt-2 inline-block ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => router.push(`/item/${item.id}`)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-lg transition">👁 View</button>
                      <button onClick={() => handleEditOpen(item, "found")} className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-medium px-3 py-1.5 rounded-lg transition">✏️ Edit</button>
                      <button onClick={() => handleDelete(item.id, "found")} className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium px-3 py-1.5 rounded-lg transition">🗑 Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Claims — Owner View */}
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">My Item Claims</h2>
            <span className="text-sm text-gray-400">{claims.length} total claims</span>
          </div>

          {claims.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">✋</p>
              <p className="text-gray-400">No claims submitted yet.</p>
              <p className="text-gray-400 text-sm mt-1">Go to Matches page to find and claim your lost items.</p>
              <button
                onClick={() => router.push("/matches")}
                className="mt-4 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
              >
                Find Matches
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {claims.map((claim) => (
                <div key={claim.id} className="border border-gray-200 rounded-xl p-5">

                  {/* Claim Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                        claim.status === "approved" ? "bg-green-100 text-green-700" :
                        claim.status === "rejected" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {claim.status === "pending_verification" ? "⏳ Pending Verification" :
                         claim.status === "approved" ? "✅ Approved by Admin" :
                         claim.status === "rejected" ? "❌ Rejected by Admin" : claim.status}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                        {claim.match_score}% match
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(claim.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Items Side by Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-red-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-red-600 mb-2">YOUR LOST ITEM</p>
                      <div className="flex items-center gap-3">
                        {claim.lost_item?.image_urls?.[0] || claim.lost_item?.image_url ? (
                          <img src={claim.lost_item?.image_urls?.[0] || claim.lost_item?.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 text-2xl">🔍</div>
                        )}
                        <div>
                          <p className="font-bold text-gray-800">{claim.lost_item?.item_name}</p>
                          <p className="text-xs text-gray-500">{claim.lost_item?.category}</p>
                          <p className="text-xs text-gray-400">📍 {claim.lost_item?.location}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-green-600 mb-2">MATCHED FOUND ITEM</p>
                      <div className="flex items-center gap-3">
                        {claim.found_item?.image_urls?.[0] || claim.found_item?.image_url ? (
                          <img src={claim.found_item?.image_urls?.[0] || claim.found_item?.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 text-2xl">📦</div>
                        )}
                        <div>
                          <p className="font-bold text-gray-800">{claim.found_item?.item_name}</p>
                          <p className="text-xs text-gray-500">{claim.found_item?.category}</p>
                          <p className="text-xs text-gray-400">📍 {claim.found_item?.location}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── APPROVED — Show Admin Office Collection Message ── */}
                  {claim.status === "approved" && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-green-700 text-sm font-semibold mb-2">✅ Claim Approved!</p>
                      <p className="text-green-600 text-sm">Your claim has been verified by admin.</p>
                      <div className="mt-3 bg-white border border-green-300 rounded-lg p-3">
                        <p className="text-green-800 text-sm font-bold">📍 Next Step — Collect Your Item:</p>
                        <p className="text-green-700 text-sm mt-1">
                          Please visit the <strong>Admin Office</strong> to collect your item.
                          Bring your <strong>University ID card</strong> for identity verification.
                        </p>
                        <p className="text-orange-600 text-xs mt-2 font-medium">
                          ⚠️ Do NOT contact the finder directly. Admin will handle the handover process.
                        </p>
                      </div>
                      {claim.admin_notes && (
                        <p className="text-green-600 text-xs mt-3 bg-green-100 px-3 py-2 rounded-lg">
                          📝 Admin note: {claim.admin_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── REJECTED ── */}
                  {claim.status === "rejected" && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-red-700 text-sm font-semibold mb-1">❌ Claim Rejected</p>
                      <p className="text-red-600 text-sm">Your claim was not verified by admin. This item may not belong to you.</p>
                      {claim.admin_notes && (
                        <p className="text-red-600 text-xs mt-2 bg-red-100 px-3 py-1.5 rounded-lg">
                          📝 Admin note: {claim.admin_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── PENDING ── */}
                  {claim.status === "pending_verification" && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-yellow-700 text-sm font-semibold mb-1">⏳ Waiting for Verification</p>
                      <p className="text-yellow-600 text-sm">Admin is reviewing your claim. You will be notified once verified.</p>
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Edit Item</h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input type="text" name="item_name" title="item_name" value={editItem.item_name} onChange={handleEditChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select name="category" value={editItem.category} onChange={handleEditChange} title="category" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="electronics">Electronics</option>
                  <option value="documents">Documents / ID Cards</option>
                  <option value="clothing">Clothing</option>
                  <option value="bags">Bags / Backpacks</option>
                  <option value="books">Books / Stationery</option>
                  <option value="jewelry">Jewelry / Accessories</option>
                  <option value="keys">Keys</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" title="description" value={editItem.description} onChange={handleEditChange} rows={3} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" name="location" title="location" value={editItem.location} onChange={handleEditChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{editType === "lost" ? "Date Lost" : "Date Found"}</label>
                <input type="date" name={editType === "lost" ? "date_lost" : "date_found"} title="date" value={editType === "lost" ? editItem.date_lost : editItem.date_found} onChange={handleEditChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input type="email" name="contact_email" title="contact_email" value={editItem.contact_email} onChange={handleEditChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                <input type="tel" name="contact_phone" title="contact_phone" value={editItem.contact_phone || ""} onChange={handleEditChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Images</label>
                {editItem.image_urls && editItem.image_urls.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {editItem.image_urls.map((url: string, i: number) => (
                      <div key={i} className="relative">
                        <img src={url} alt={`img ${i}`} className="w-full h-20 object-cover rounded-lg" />
                        <button type="button" onClick={() => removeEditImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm mb-2">No images yet</p>
                )}
                <label className="block text-sm font-medium text-gray-700 mb-1">Add New Images</label>
                <input type="file" accept="image/*" multiple onChange={handleEditImageChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm" />
                {editPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {editPreviews.map((preview, i) => (
                      <img key={i} src={preview} alt={`new ${i}`} className="w-full h-20 object-cover rounded-lg" />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={() => setEditItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button onClick={handleEditSave} disabled={editLoading} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg transition font-medium disabled:opacity-50">
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}