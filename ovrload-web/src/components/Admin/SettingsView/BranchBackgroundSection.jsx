import { useState } from "react";
import { useUpload } from "@/utils/useUpload";

export function BranchBackgroundSection({
  branchBackgroundUrl,
  onUpdateBranchBackground,
}) {
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [upload] = useUpload();

  const handleBackgroundUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackgroundLoading(true);
    try {
      const result = await upload({ file });

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.url) {
        throw new Error("Upload did not return a URL");
      }

      await onUpdateBranchBackground(result.url);
      alert("Branch background updated successfully!");
    } catch (error) {
      console.error("Error uploading branch background:", error);
      const message = error?.message || "Unknown error";
      const needsLogin =
        typeof message === "string" &&
        (message.toLowerCase().includes("unauthorized") ||
          message.toLowerCase().includes("401"));

      if (needsLogin) {
        alert(
          "Your admin login expired. Please log in again, then try uploading.",
        );
      } else {
        alert(`Failed to upload branch background: ${message}`);
      }
    } finally {
      try {
        e.target.value = "";
      } catch (err) {
        // ignore
      }
      setBackgroundLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Branch Selection Background
      </h3>

      {branchBackgroundUrl && (
        <div className="mb-4">
          <img
            src={branchBackgroundUrl}
            alt="Branch background preview"
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="branch-background"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Upload Background Image
        </label>
        <input
          id="branch-background"
          type="file"
          accept="image/*"
          onChange={handleBackgroundUpload}
          disabled={backgroundLoading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-2 text-sm text-gray-500">
          This image will be displayed as the background on the branch selection
          page. Recommended size: 1080x1920px or similar portrait ratio.
        </p>
        {backgroundLoading && (
          <p className="mt-2 text-sm text-blue-600">Uploading...</p>
        )}
      </div>
    </div>
  );
}
