"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function ImageSlider({ images, fallback }: { images: string[], fallback: string }) {
  const [current, setCurrent] = useState(0);

  if (images.length === 0) {
    return (
      <div className="w-full h-48 bg-gray-100 rounded-xl mb-4 flex items-center justify-center">
        <span className="text-5xl">{fallback}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden">
      <img src={images[current]} alt="item" className="w-full h-48 object-cover" />
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent(current === 0 ? images.length - 1 : current - 1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-opacity-80"
          >‹</button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent(current === images.length - 1 ? 0 : current + 1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-opacity-80"
          >›</button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                className={`w-2 h-2 rounded-full transition ${i === current ? "bg-white" : "bg-white bg-opacity-50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [foundItems, setFoundItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("lost");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data: lost } = await supabase
      .from("lost_items")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: found } = await supabase
      .from("found_items")
      .select("*")
      .order("created_at", { ascending: false });

    setLostItems(lost || []);
    setFoundItems(found || []);
    setLoading(false);
  };

  const filterItems = (items: any[]) => {
    return items.filter((item) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        search === "" ||
        item.item_name?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.location?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower);

      const matchesCategory =
        categoryFilter === "" || item.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  };

  const filteredItems = filterItems(activeTab === "lost" ? lostItems : foundItems);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero Section */}
      <section className="bg-blue-700 text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          University Lost & Found System
        </h1>
        <p className="text-lg md:text-xl mb-8 text-blue-100">
          Lost something? Found something? Report it and let AI find the match!
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center mb-8">
          <a href="/report-lost" className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-semibold text-lg transition">
            Report Lost Item
          </a>
          <a href="/report-found" className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-semibold text-lg transition">
            Report Found Item
          </a>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 bg-white rounded-full p-2 shadow-lg">
            <span className="pl-3 flex items-center text-gray-400 text-xl">🔍</span>
            <input
              type="text"
              placeholder="Search by item name, location, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-gray-800 focus:outline-none rounded-full text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-gray-600 px-3"
              >✕</button>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-4xl font-bold text-blue-700">{lostItems.length + foundItems.length}</p>
          <p className="text-gray-500 mt-2">Items Reported</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-4xl font-bold text-green-600">{foundItems.length}</p>
          <p className="text-gray-500 mt-2">Items Found</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-4xl font-bold text-red-500">{lostItems.length}</p>
          <p className="text-gray-500 mt-2">Items Lost</p>
        </div>
      </section>

      {/* Items Section */}
      <section className="py-8 px-4 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Recently Reported Items
        </h2>

        {/* Tabs + Filter */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">

          {/* Tabs */}
          <div className="bg-white rounded-full shadow p-1 flex gap-2">
            <button
              onClick={() => setActiveTab("lost")}
              className={`px-6 py-2 rounded-full font-semibold text-sm transition ${activeTab === "lost" ? "bg-red-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >
              Lost Items ({lostItems.length})
            </button>
            <button
              onClick={() => setActiveTab("found")}
              className={`px-6 py-2 rounded-full font-semibold text-sm transition ${activeTab === "found" ? "bg-green-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >
              Found Items ({foundItems.length})
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            title="category filter"
            className="border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Categories</option>
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

        {/* Search Results Info */}
        {search && (
          <div className="mb-6 text-center">
            <p className="text-gray-500 text-sm">
              Showing <span className="font-bold text-gray-800">{filteredItems.length}</span> results for
              <span className="font-bold text-blue-700"> "{search}"</span>
            </p>
          </div>
        )}

        {/* Items Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Loading items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-gray-400 text-lg">No items found matching your search.</p>
            {search && (
              <button
                onClick={() => { setSearch(""); setCategoryFilter(""); }}
                className="mt-4 text-blue-700 hover:underline text-sm"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl shadow p-6 hover:shadow-md transition cursor-pointer"
                onClick={() => router.push(`/item/${item.id}`)}
              >
                <ImageSlider
                  images={item.image_urls && item.image_urls.length > 0 ? item.image_urls : item.image_url ? [item.image_url] : []}
                  fallback={activeTab === "lost" ? "🔍" : "📦"}
                />

                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${activeTab === "lost" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {activeTab === "lost" ? "LOST" : "FOUND"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {activeTab === "lost" ? item.date_lost : item.date_found}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-800 mb-1">{item.item_name}</h3>
                <p className="text-xs text-blue-600 font-medium mb-2">{item.category}</p>
                <p className="text-gray-500 text-sm mb-3 line-clamp-2">{item.description}</p>
                <div className="flex items-center gap-1 text-gray-400 text-sm">
                  <span>📍</span>
                  <span>{item.location}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-16 px-4 mt-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">How It Works</h2>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-blue-100 text-blue-700 rounded-full w-16 h-16 flex items-center justify-center text-3xl">1</div>
            <h3 className="text-xl font-semibold">Report</h3>
            <p className="text-gray-500">Submit a lost or found item report with description and photo.</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-yellow-100 text-yellow-700 rounded-full w-16 h-16 flex items-center justify-center text-3xl">2</div>
            <h3 className="text-xl font-semibold">AI Matches</h3>
            <p className="text-gray-500">Our AI analyzes descriptions and images to find possible matches.</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-green-100 text-green-700 rounded-full w-16 h-16 flex items-center justify-center text-3xl">3</div>
            <h3 className="text-xl font-semibold">Recover</h3>
            <p className="text-gray-500">Get notified instantly when a match is found and recover your item.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-900 text-blue-200 text-center py-6 text-sm">
        <p>2026 Lost and Found System - University of Kotli AJK</p>
      </footer>

    </div>
  );
}