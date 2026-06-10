"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useUpload from "@/utils/useUpload";

export default function LogoUpload() {
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [logoImgError, setLogoImgError] = useState(null);
  const [imgSrcOverride, setImgSrcOverride] = useState(null);
  const queryClient = useQueryClient();
  const [upload, { loading: uploadcareLoading }] = useUpload();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("admin_roles");
      const roles = raw ? JSON.parse(raw) : [];
      const isBackendAdmin = Array.isArray(roles) && roles.includes("backend");
      if (!isBackendAdmin) {
        window.location.href = "/admin";
      }
    } catch (e) {
      window.location.href = "/admin";
    }
  }, []);

  // Get current logo
  const logoQuery = useQuery({
    queryKey: ["logo"],
    queryFn: async () => {
      const response = await fetch("/api/logo", { cache: "no-store" });
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const logoData = logoQuery.data;

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      // 1) Upload from the browser (preferred; avoids server-side upload limits and tends to be embed-safe)
      const uploadResult = await upload({ file });
      if (uploadResult?.error) {
        throw new Error(uploadResult.error);
      }

      const rawUrl = uploadResult?.url;
      const mimeType = uploadResult?.mimeType || "";

      if (!rawUrl) {
        throw new Error("Upload failed: no URL returned");
      }

      if (mimeType && !String(mimeType).startsWith("image/")) {
        throw new Error("Please upload an image file");
      }

      // 2) Store URL in DB
      const response = await fetch("/api/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl }),
      });

      if (!response.ok) {
        throw new Error(
          "When saving /api/logo, the response was [" +
            response.status +
            "] " +
            response.statusText,
        );
      }

      const data = await response.json();
      return {
        saved: data,
        rawUrl,
      };
    },
    onSuccess: async (data) => {
      setLogoImgError(null);
      setImgSrcOverride(null);
      setUploadedUrl(data?.rawUrl || "");
      await queryClient.invalidateQueries({ queryKey: ["logo"] });
      await queryClient.refetchQueries({ queryKey: ["logo"] });
    },
    onError: (error) => {
      console.error("Logo upload failed", error);
      setLogoImgError(
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      );
    },
  });

  const displayLogoUrl = useMemo(() => {
    const candidate = logoData?.url || null;
    if (!candidate) {
      return null;
    }

    if (typeof candidate === "string" && candidate.startsWith("/api/")) {
      return candidate;
    }

    // If backend returns an Uploadcare URL, it should be embed-safe.
    if (typeof candidate === "string" && candidate.includes("ucarecdn.com")) {
      return candidate;
    }

    // Otherwise, proxy through our backend to avoid hotlink/CORP issues.
    if (
      typeof candidate === "string" &&
      (candidate.startsWith("http://") || candidate.startsWith("https://"))
    ) {
      return "/api/image-proxy?url=" + encodeURIComponent(candidate);
    }

    return candidate;
  }, [logoData]);

  const imgSrc = imgSrcOverride || displayLogoUrl;

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setLogoImgError(null);

    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
    }
  };

  const shouldShowCurrentLogo = !!imgSrc;
  const isBusy = isUploading || uploadcareLoading || uploadMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Upload NEO Bakery Logo
          </h1>

          {/* Current Logo Display */}
          {shouldShowCurrentLogo ? (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-700 mb-4">
                Current Logo:
              </h3>
              <div className="flex items-center justify-center p-6 bg-gray-100 rounded-lg">
                <img
                  key={String(imgSrc)}
                  src={imgSrc}
                  alt="Current NEO Bakery Logo"
                  className="max-w-[200px] max-h-[200px] object-contain"
                  onError={(e) => {
                    const rawUrl = logoData?.rawUrl;
                    const updatedAt = logoData?.updatedAt
                      ? new Date(logoData.updatedAt).getTime()
                      : Date.now();

                    console.error("Logo image failed to load", {
                      rawUrl,
                      url: logoData?.url,
                      displayLogoUrl,
                      imgSrc,
                      eventType: e?.type,
                    });

                    const isProxySrc =
                      typeof imgSrc === "string" &&
                      imgSrc.startsWith("/api/image-proxy");

                    // If the proxy fails, try to fetch it once and show the real error message
                    // (e.g. upstream 403, HTML block page, etc.).
                    if (isProxySrc) {
                      (async () => {
                        try {
                          const res = await fetch(imgSrc, {
                            cache: "no-store",
                          });
                          if (!res.ok) {
                            const text = await res.text();
                            const msg = (text || "").slice(0, 200);
                            if (msg) {
                              setLogoImgError(msg);
                            }
                          }
                        } catch (fetchErr) {
                          console.error(
                            "Could not read proxy error body",
                            fetchErr,
                          );
                        }
                      })();
                    }

                    // If the proxy fails, try direct once (helps diagnose)
                    if (isProxySrc && rawUrl && !imgSrcOverride) {
                      const joinChar = rawUrl.includes("?") ? "&" : "?";
                      const rawWithVersion =
                        rawUrl +
                        joinChar +
                        "v=" +
                        encodeURIComponent(String(updatedAt));
                      setImgSrcOverride(rawWithVersion);
                      setLogoImgError(
                        "Could not load via our proxy. Retrying direct URL…",
                      );
                      return;
                    }

                    setLogoImgError(
                      "Could not load the logo image. The file exists, but this URL is not embeddable in the app.",
                    );
                  }}
                />
              </div>

              {logoImgError ? (
                <div className="mt-3 text-sm text-red-600">{logoImgError}</div>
              ) : null}

              {logoData?.rawUrl ? (
                <div className="mt-3 text-sm text-gray-600">
                  <a
                    className="text-blue-600 hover:text-blue-500 underline"
                    href={logoData.rawUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open original file
                  </a>
                </div>
              ) : null}

              {imgSrc ? (
                <div className="mt-2 text-xs text-gray-500 break-all">
                  Display URL: {imgSrc}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mb-8 text-sm text-gray-600">
              No logo uploaded yet.
            </div>
          )}

          {/* Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="space-y-4">
              <div className="flex justify-center">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              <div>
                <label htmlFor="logo-upload" className="cursor-pointer">
                  <span className="text-lg font-medium text-blue-600 hover:text-blue-500">
                    {isBusy ? "Uploading..." : "Click to upload your logo"}
                  </span>
                  <input
                    id="logo-upload"
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isBusy}
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>

              {isBusy ? (
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Upload Success */}
          {uploadedUrl ? (
            <div className="mt-8 p-4 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-green-400 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-green-800 font-medium">
                  Logo uploaded successfully!
                </p>
              </div>
              <p className="text-green-700 text-sm mt-1">
                If you don’t see it update right away, refresh this page once.
              </p>
            </div>
          ) : null}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Instructions:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Upload your NEO bakery logo (favicon512x512.png)</li>
              <li>• Recommended size: 512x512px or similar square format</li>
              <li>
                • The logo will replace the text "NEO" in your mobile app header
              </li>
              <li>
                • Make sure your logo works well on both light and dark
                backgrounds
              </li>
            </ul>
          </div>

          <div className="mt-6">
            <a
              href="/admin"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              ← Back to Admin
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
