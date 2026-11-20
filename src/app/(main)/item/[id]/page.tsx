"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function ItemDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [poster, setPoster] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [itemType, setItemType] = useState<"lost" | "found">("lost");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    checkUserAndFetchItem();
  }, [id]);

  const checkUserAndFetchItem = async () => {
    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "admin") setIsAdmin(true);
    }
    fetchItem();
  };

  const fetchItem = async () => {
    const { data: lostItem } = await supabase
      .from("lost_items")
      .select("*")
      .eq("id", id)
      .single();

    if (lostItem) {
      setItem(lostItem);
      setItemType("lost");
      fetchPoster(lostItem.user_id);
      setLoading(false);
      return;
    }

    const { data: foundItem } = await supabase
      .from("found_items")
      .select("*")
      .eq("id", id)
      .single();

    if (foundItem) {
      setItem(foundItem);
      setItemType("found");
      fetchPoster(foundItem.user_id);
    }

    setLoading(false);
  };

  const fetchPoster = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setPoster(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading item details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-lg">Item not found.</p>
      </div>
    );
  }

  const images = item.image_urls && item.image_urls.length > 0
    ? item.image_urls
    : item.image_url
    ? [item.image_url]
    : [];

  // ✅ Check if current user is the owner of this item
  const isOwner = currentUserId === item.user_id;

  // ✅ Can see contact info if: admin OR owner of the item
  const canSeeContact = isAdmin || isOwner;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-700 hover:underline mb-6 text-sm font-medium"
        >
          ← Back
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Left — Images */}
          <div>
            {images.length > 0 ? (
              <div>
                <div className="relative w-full h-80 rounded-2xl overflow-hidden mb-3">
                  <img
                    src={images[currentImage]}
                    alt={item.item_name}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImage(currentImage === 0 ? images.length - 1 : currentImage - 1)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-80"
                      >
                        ‹
                      </button>
                      <button
                        onClick={() => setCurrentImage(currentImage === images.length - 1 ? 0 : currentImage + 1)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-80"
                      >
                        ›
                      </button>
                    </>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((img: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImage(i)}
                        className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${i === currentImage ? "border-blue-500" : "border-transparent"}`}
                      >
                        <img src={img} alt={`thumbnail ${i}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-80 bg-gray-100 rounded-2xl flex items-center justify-center">
                <span className="text-8xl">{itemType === "lost" ? "🔍" : "📦"}</span>
              </div>
            )}
          </div>

          {/* Right — Details */}
          <div className="flex flex-col gap-5">

            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold px-4 py-1.5 rounded-full ${itemType === "lost" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {itemType === "lost" ? "LOST ITEM" : "FOUND ITEM"}
              </span>
              <span className="text-sm font-semibold px-4 py-1.5 rounded-full bg-yellow-100 text-yellow-700">
                {item.status}
              </span>
            </div>

            <h1 className="text-3xl font-bold text-gray-800">{item.item_name}</h1>

            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-medium text-sm bg-blue-50 px-3 py-1 rounded-full">
                {item.category}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</h3>
              <p className="text-gray-700 leading-relaxed">{item.description}</p>
            </div>

            <div className="flex items-start gap-3 bg-gray-100 rounded-xl p-4">
              <span className="text-2xl">📍</span>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase">Location</p>
                <p className="text-gray-800 font-semibold">{item.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-gray-100 rounded-xl p-4">
              <span className="text-2xl">📅</span>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase">
                  {itemType === "lost" ? "Date Lost" : "Date Found"}
                </p>
                <p className="text-gray-800 font-semibold">
                  {itemType === "lost" ? item.date_lost : item.date_found}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Posted By Section */}
        <div className="mt-8 bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Posted By</h2>
          <div className="flex items-center gap-4">
            {poster?.avatar_url ? (
              <img
                src={poster.avatar_url}
                alt="poster"
                className="w-16 h-16 rounded-full object-cover border-2 border-blue-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-700 text-white flex items-center justify-center text-2xl font-bold">
                {poster?.full_name?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
            <div>
              {/* ✅ Name always visible */}
              <p className="text-lg font-bold text-gray-800">
                {poster?.full_name || "Unknown"}
              </p>
              {/* <p className="text-sm text-gray-500">{poster?.department || "N/A"}</p>
              <p className="text-sm text-gray-500">
                Semester {poster?.semester || "N/A"}
              </p> */}

              {/* ✅ Student ID only visible to admin */}
              {canSeeContact && (
                <p className="text-sm text-gray-500">
                  Student ID: {poster?.student_id || "N/A"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ✅ Contact Section — Admin and Owner only */}
        {canSeeContact ? (
          <div className="mt-6 bg-white rounded-2xl shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-gray-800">Contact Information</h2>
              {isAdmin && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                  👮 Admin View
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📧</span>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Email</p>
                  <a href={`mailto:${item.contact_email}`} className="text-blue-700 hover:underline font-medium">
                    {item.contact_email}
                  </a>
                </div>
              </div>
              {item.contact_phone && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Phone</p>
                    <a href={`tel:${item.contact_phone}`} className="text-blue-700 hover:underline font-medium">
                      {item.contact_phone}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ✅ Message shown to regular users */
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
            {/* <span className="text-4xl mb-3 block">🔒</span>
            <h2 className="text-lg font-bold text-gray-700 mb-2">
              Contact Information Hidden
            </h2>
            <p className="text-gray-500 text-sm">
              Contact details are only visible to admins.
              To recover this item, please use the
              <span className="text-blue-700 font-semibold"> Matches </span>
              feature and submit a claim.
            </p> */}
            <button
              onClick={() => router.push("/matches")}
              className="mt-4 bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              🤖 Find Matches
            </button>
          </div>
        )}

      </div>
    </div>
  );
}