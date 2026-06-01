"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ReportFoundPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

    const { error: insertError } = await supabase.from("found_items").insert({
      user_id: user.id,
      item_name: formData.itemName,
      category: formData.category,
      description: formData.description,
      location: formData.location,
      date_found: formData.date,
      contact_email: formData.contactEmail,
      contact_phone: formData.contactPhone,
      image_url: imageUrls[0] || "",
      image_urls: imageUrls,
      status: "available",
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    alert("Found item reported successfully!");
    router.push("/");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Report Found Item</h1>
          <p className="text-gray-500 mt-2">Found something? Help return it to its owner!</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input type="text" name="itemName" placeholder="e.g. Blue Backpack" value={formData.itemName} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select name="category" value={formData.category} onChange={handleChange} required title="category" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Select a category</option>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea name="description" placeholder="Describe the item in detail..." value={formData.description} onChange={handleChange} required rows={4} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Found Location *</label>
              <input type="text" name="location" placeholder="e.g. Cafeteria, Main Gate" value={formData.location} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Found *</label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email *</label>
              <input type="email" name="contactEmail" placeholder="your@email.com" value={formData.contactEmail} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input type="tel" name="contactPhone" placeholder="03001234567" value={formData.contactPhone} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            {/* Multiple Images Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Images (optional, max 5)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              />
              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img src={preview} alt={`preview ${index}`} className="w-full h-24 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition text-lg mt-2 disabled:opacity-50">
              {loading ? "Submitting..." : "Submit Found Item Report"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}