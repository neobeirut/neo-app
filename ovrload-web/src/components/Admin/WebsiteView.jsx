"use client";

import { useState, useEffect } from "react";
import { PlusCircle, Trash2, GripVertical, Save } from "lucide-react";
import useUpload from "@/utils/useUpload";

export default function WebsiteView() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [upload, { loading: uploading }] = useUpload();

  useEffect(() => {
    fetchSliderImages();
  }, []);

  const fetchSliderImages = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/settings/hero-slider");
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
      }
    } catch (error) {
      console.error("Error fetching slider images:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddImage = async (file) => {
    try {
      const result = await upload({ file });

      if (result.error) {
        throw new Error(result.error);
      }

      const newImage = {
        id: Date.now(),
        url: result.url,
        title: "",
        subtitle: "",
      };

      setImages([...images, newImage]);
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleAddImage(file);
    }
  };

  const handleRemoveImage = (id) => {
    if (confirm("Are you sure you want to remove this image?")) {
      setImages(images.filter((img) => img.id !== id));
    }
  };

  const handleUpdateImage = (id, field, value) => {
    setImages(
      images.map((img) => (img.id === id ? { ...img, [field]: value } : img)),
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/settings/hero-slider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ images }),
      });

      if (response.ok) {
        alert("Slider images saved successfully!");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Error saving slider images:", error);
      alert("Failed to save slider images");
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);

    setImages(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Loading slider images...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hero Slider</h2>
          <p className="text-gray-600 mt-1">
            Manage images for the main page hero slider
          </p>
        </div>
        <div className="flex gap-3">
          <label className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-600 transition-colors cursor-pointer">
            <PlusCircle size={20} />
            Add Image
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors disabled:bg-gray-400"
          >
            <Save size={20} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">Uploading image...</p>
        </div>
      )}

      {images.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">No slider images yet</p>
          <label className="inline-flex bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer">
            <PlusCircle size={20} className="mr-2" />
            Add First Image
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className="bg-white rounded-lg shadow-md p-6 cursor-move hover:shadow-lg transition-shadow"
            >
              <div className="flex gap-4">
                <div className="flex items-center text-gray-400">
                  <GripVertical size={24} />
                </div>

                <div className="flex-shrink-0">
                  <img
                    src={image.url}
                    alt={image.title || "Slider image"}
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                </div>

                <div className="flex-grow space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image URL
                    </label>
                    <input
                      type="text"
                      value={image.url}
                      onChange={(e) =>
                        handleUpdateImage(image.id, "url", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title (optional)
                    </label>
                    <input
                      type="text"
                      value={image.title || ""}
                      onChange={(e) =>
                        handleUpdateImage(image.id, "title", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Welcome to NEO Beirut"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subtitle (optional)
                    </label>
                    <input
                      type="text"
                      value={image.subtitle || ""}
                      onChange={(e) =>
                        handleUpdateImage(image.id, "subtitle", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Experience the finest pastries..."
                    />
                  </div>
                </div>

                <div className="flex items-start">
                  <button
                    onClick={() => handleRemoveImage(image.id)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Tips:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Drag and drop images to reorder them</li>
          <li>
            Title and subtitle are optional and will appear as overlay text
          </li>
          <li>Recommended image size: 1920x1080 pixels or larger</li>
          <li>Images will automatically transition every 5 seconds</li>
        </ul>
      </div>
    </div>
  );
}
