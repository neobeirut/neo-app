import { useState } from "react";

export function WebsiteIconSection({ websiteIconUrl, onUpdateWebsiteIcon }) {
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      // Step 1: Upload file directly to CDN
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/_create/api/upload/", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to CDN");
      }

      const uploadData = await uploadResponse.json();
      const imageUrl = uploadData.url;

      if (!imageUrl) {
        throw new Error("No URL returned from upload");
      }

      // Step 2: Save URL to backend
      const adminToken =
        typeof window !== "undefined"
          ? localStorage.getItem("admin_token")
          : null;

      const saveResponse = await fetch("/api/settings/website-icon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {}),
        },
        body: JSON.stringify({ url: imageUrl }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save icon");
      }

      const data = await saveResponse.json();
      onUpdateWebsiteIcon(data.url);
      alert("Website icon uploaded successfully!");
    } catch (error) {
      console.error("Error uploading icon:", error);
      alert(error.message || "Failed to upload icon. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Website Icon (Favicon)
      </h3>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-3">
            This icon appears in browser tabs and bookmarks. For best results,
            use a square PNG image (512x512px or larger).
          </p>
        </div>

        {websiteIconUrl && (
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              <img
                src={websiteIconUrl}
                alt="Current website icon"
                className="w-16 h-16 object-contain rounded-lg border-2 border-gray-300"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Current Icon</p>
              <p className="text-xs text-gray-500 mt-1 break-all">
                {websiteIconUrl}
              </p>
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="icon-upload"
            className={`
              inline-flex items-center px-4 py-2 border border-gray-300 rounded-md
              shadow-sm text-sm font-medium text-gray-700 bg-white
              hover:bg-gray-50 focus:outline-none focus:ring-2
              focus:ring-offset-2 focus:ring-blue-500 cursor-pointer
              ${uploading ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            {uploading ? (
              <>
                <svg
                  className="-ml-1 mr-2 h-4 w-4 text-gray-700"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg
                  className="-ml-1 mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                {websiteIconUrl ? "Replace Icon" : "Upload Icon"}
              </>
            )}
          </label>
          <input
            id="icon-upload"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Recommended: PNG format, 512x512px or larger</p>
          <p>• Maximum file size: 5MB</p>
          <p>• Square images work best</p>
        </div>
      </div>
    </div>
  );
}
