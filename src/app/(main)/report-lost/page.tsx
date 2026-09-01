"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ReportLostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    itemName: "",
    category: "",
    description: "",
    location: "",
    date: "",
    contactEmail: "",
    contactPhone: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      setError("Maximum 5 images allowed!");
      return;
    }
    setImages([...images, ...files]);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews([...previews, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in!");
      setLoading(false);
      return;
    }

    const imageUrls: string[] = [];

    for (const image of images) {
      const fileExt = image.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(fileName, image);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("item-images")
          .getPublicUrl(fileName);
        imageUrls.push(urlData.publicUrl);
      }
    }

    const { error: insertError } = await supabase.from("lost_items").insert({
      user_id: user.id,
      item_name: formData.itemName,
      category: formData.category,
      description: formData.description,
      location: formData.location,
      date_lost: formData.date,
      contact_email: formData.contactEmail,
      contact_phone: formData.contactPhone,
      image_url: imageUrls[0] || "",
      image_urls: imageUrls,
      status: "searching",
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setShowSuccess(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">

      {/* ── SUCCESS POPUP ── */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center animate-bounce-once">

            {/* Icon */}
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-5xl">🔍</span>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Report Submitted!
            </h2>
            <p className="text-gray-500 mb-6">
              Your lost item <span className="font-semibold text-red-500">"{formData.itemName}"</span> has been reported successfully. Our AI will search for matches!
            </p>

            {/* Steps */}
            <div className="bg-red-50 rounded-2xl p-4 mb-6 text-left">
              <p className="text-red-700 text-sm font-bold mb-3">📋 What happens next?</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
                  AI will match your item with found items
                </div>
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
                  You'll get notified when a match is found
                </div>
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
                  Admin will verify and arrange handover
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/matches")}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition"
              >
                🤖 Find Matches Now
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition"
              >
                📊 Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setFormData({
                    itemName: "", category: "", description: "",
                    location: "", date: "", contactEmail: "", contactPhone: "",
                  });
                  setImages([]);
                  setPreviews([]);
                }}
                className="text-gray-400 hover:text-gray-600 text-sm transition"
              >
                Report another item
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── FORM ── */}
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔍</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Report Lost Item</h1>
          <p className="text-gray-500 mt-2">Fill in the details and our AI will search for matches</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Item Name *</label>
                <input
                  type="text"
                  name="itemName"
                  placeholder="e.g. Black Wallet"
                  value={formData.itemName}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  title="category"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50"
                >
                  <option value="">Select category</option>
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
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description *</label>
              <textarea
                name="description"
                placeholder="Describe the item in detail — color, brand, size, any unique marks..."
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last Seen Location *</label>
                <input
                  type="text"
                  name="location"
                  placeholder="e.g. Library, Room 204"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date Lost *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Email *</label>
                <input
                  type="email"
                  name="contactEmail"
                  placeholder="your@email.com"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Phone</label>
                <input
                  type="tel"
                  name="contactPhone"
                  placeholder="03001234567"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50"
                />
              </div>
            </div>

            {/* Images Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Upload Images (optional, max 5)
              </label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-red-300 transition">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="w-full text-sm text-gray-500"
                />
                <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5 images</p>
              </div>
              {previews.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mt-3">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img src={preview} alt={`preview ${index}`} className="w-full h-20 object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 rounded-xl transition text-base mt-2 disabled:opacity-50 shadow-lg shadow-red-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Submitting Report...
                </span>
              ) : "🔍 Submit Lost Item Report"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}