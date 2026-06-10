import { Upload, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { reorder } from "./utils";

export function RecapSection({
  isPast,
  recapCaption,
  setRecapCaption,
  recapImages,
  setRecapImages,
  handleRecapImagesUpload,
  recapVideos,
  setRecapVideos,
  handleRecapVideosUpload,
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-900">Past Event Recap</div>
        <div className="text-sm text-gray-500">
          {isPast ? "Past event" : "Available once the event is past"}
        </div>
      </div>

      {!isPast ? (
        <div className="mt-3 text-sm text-gray-500">
          This section will appear once the event date has passed.
        </div>
      ) : (
        <>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recap caption
            </label>
            <textarea
              value={recapCaption}
              onChange={(e) => setRecapCaption(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg min-h-[70px]"
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Upload recap images
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleRecapImagesUpload}
                className="mt-2 w-full"
              />

              {recapImages.length ? (
                <div className="mt-3 space-y-2">
                  {recapImages.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="flex items-center gap-2 border rounded-lg p-2"
                    >
                      <img
                        src={url}
                        alt="recap"
                        className="w-14 h-14 object-cover rounded"
                      />
                      <div className="flex-1 text-xs text-gray-600 break-all">
                        {url}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            idx > 0 &&
                            setRecapImages(reorder(recapImages, idx, idx - 1))
                          }
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          onClick={() =>
                            idx < recapImages.length - 1 &&
                            setRecapImages(reorder(recapImages, idx, idx + 1))
                          }
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          onClick={() =>
                            setRecapImages(
                              recapImages.filter((_, i) => i !== idx),
                            )
                          }
                          className="p-1 rounded hover:bg-gray-100 text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500">
                  No recap images.
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Upload recap videos (mp4 preferred)
              </label>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={handleRecapVideosUpload}
                className="mt-2 w-full"
              />

              {recapVideos.length ? (
                <div className="mt-3 space-y-2">
                  {recapVideos.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="flex items-center gap-2 border rounded-lg p-2"
                    >
                      <div className="w-14 h-14 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                        <Upload size={18} />
                      </div>
                      <div className="flex-1 text-xs text-gray-600 break-all">
                        {url}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            idx > 0 &&
                            setRecapVideos(reorder(recapVideos, idx, idx - 1))
                          }
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          onClick={() =>
                            idx < recapVideos.length - 1 &&
                            setRecapVideos(reorder(recapVideos, idx, idx + 1))
                          }
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          onClick={() =>
                            setRecapVideos(
                              recapVideos.filter((_, i) => i !== idx),
                            )
                          }
                          className="p-1 rounded hover:bg-gray-100 text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500">
                  No recap videos.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
