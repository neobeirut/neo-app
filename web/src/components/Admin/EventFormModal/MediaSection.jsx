import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { reorder } from "./utils";

export function MediaSection({
  coverImage,
  handleCoverUpload,
  images,
  setImages,
  handleImagesUpload,
  uploadLoading,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Cover image *
          </label>
          {uploadLoading ? (
            <span className="text-sm text-blue-600">Uploading...</span>
          ) : null}
        </div>
        {coverImage ? (
          <img
            src={coverImage}
            alt="cover"
            className="mt-2 w-full h-40 object-cover rounded-lg border"
          />
        ) : (
          <div className="mt-2 w-full h-40 rounded-lg border bg-gray-50 flex items-center justify-center text-gray-500 text-sm">
            No cover image
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleCoverUpload}
          className="mt-2 w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Extra images
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImagesUpload}
          className="mt-2 w-full"
        />

        {images.length ? (
          <div className="mt-3 space-y-2">
            {images.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="flex items-center gap-2 border rounded-lg p-2"
              >
                <img
                  src={url}
                  alt="img"
                  className="w-14 h-14 object-cover rounded"
                />
                <div className="flex-1 text-xs text-gray-600 break-all">
                  {url}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      idx > 0 && setImages(reorder(images, idx, idx - 1))
                    }
                    className="p-1 rounded hover:bg-gray-100"
                    title="Move up"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() =>
                      idx < images.length - 1 &&
                      setImages(reorder(images, idx, idx + 1))
                    }
                    className="p-1 rounded hover:bg-gray-100"
                    title="Move down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    onClick={() =>
                      setImages(images.filter((_, i) => i !== idx))
                    }
                    className="p-1 rounded hover:bg-gray-100 text-red-600"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-500">No extra images.</div>
        )}
      </div>
    </div>
  );
}
