"use client";

import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    document.title = "Ovrload Admin";
    if (typeof window !== "undefined") {
      window.location.href = "/admin";
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Ovrload Admin</h1>
        <p className="text-gray-600">Redirecting to admin dashboard...</p>
      </div>
    </div>
  );
}
