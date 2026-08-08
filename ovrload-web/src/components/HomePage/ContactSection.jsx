"use client";

import { useState, useEffect } from "react";
import { MapPin, Phone, Clock } from "lucide-react";

export function ContactSection() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBranches() {
      try {
        const response = await fetch("/api/branches");
        if (!response.ok) throw new Error("Failed to fetch branches");
        const data = await response.json();
        setBranches(Array.isArray(data) ? data : data.branches || []);
      } catch (error) {
        console.error("Error fetching branches:", error);
        setBranches([]);
      } finally {
        setLoading(false);
      }
    }

    fetchBranches();
  }, []);

  const formatTime = (time) => {
    if (!time) return "N/A";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const openGoogleMaps = (location) => {
    if (!location) return;
    const [lat, lng] = location.split(",").map((coord) => coord.trim());
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      "_blank",
    );
  };

  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-[#2D5F5D] mb-4">
            Visit Our Branches
          </h2>
          <div className="w-24 h-1 bg-[#B8935A] mx-auto mb-6"></div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Find the Neo Beirut location nearest to you and experience our
            flavors in person
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block rounded-full h-16 w-16 border-4 border-[#2D5F5D] border-t-transparent">
              <style jsx>{`
                div {
                  animation: spin 1s linear infinite;
                }
                @keyframes spin {
                  from {
                    transform: rotate(0deg);
                  }
                  to {
                    transform: rotate(360deg);
                  }
                }
              `}</style>
            </div>
            <p className="mt-4 text-gray-600">Loading our branches...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group border border-gray-200"
              >
                {/* Branch Image */}
                <div className="relative h-56 overflow-hidden bg-gray-200">
                  {branch.image_url ? (
                    <img
                      src={branch.image_url}
                      alt={branch.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2D5F5D] to-[#1f4342]">
                      <div className="text-center text-white">
                        <MapPin size={48} className="mx-auto mb-2" />
                        <p className="text-2xl font-bold">{branch.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Branch Info */}
                <div className="p-6">
                  <h3 className="text-2xl font-bold mb-4 text-[#2D5F5D]">
                    {branch.name}
                  </h3>

                  {/* Address */}
                  <div className="flex items-start gap-3 mb-4">
                    <MapPin
                      size={20}
                      className="text-[#2D5F5D] mt-1 flex-shrink-0"
                    />
                    <div>
                      <p className="text-gray-700 font-medium">
                        {branch.address}
                      </p>
                      {branch.location && (
                        <button
                          onClick={() => openGoogleMaps(branch.location)}
                          className="text-[#2D5F5D] hover:underline text-sm mt-1 font-semibold"
                        >
                          Get Directions →
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-3 mb-4">
                    <Phone size={20} className="text-[#2D5F5D] flex-shrink-0" />
                    <a
                      href={`tel:${branch.phone}`}
                      className="text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
                    >
                      {branch.phone}
                    </a>
                  </div>

                  {/* Hours */}
                  <div className="flex items-start gap-3 mb-6">
                    <Clock
                      size={20}
                      className="text-[#2D5F5D] mt-1 flex-shrink-0"
                    />
                    <div>
                      <p className="text-gray-700 font-medium">Store Hours</p>
                      <p className="text-gray-600 text-sm">
                        {formatTime(branch.opening_time)} -{" "}
                        {formatTime(branch.closing_time)}
                      </p>
                      {branch.delivery_start_time &&
                        branch.delivery_end_time && (
                          <p className="text-gray-600 text-sm mt-1">
                            Delivery: {formatTime(branch.delivery_start_time)} -{" "}
                            {formatTime(branch.delivery_end_time)}
                          </p>
                        )}
                    </div>
                  </div>

                  {/* Order Button */}
                  <a
                    href="/shop"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-[#2D5F5D] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1f4342] transition-colors"
                  >
                    Order from {branch.name}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && branches.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-600 text-xl">
              No branches available at the moment.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
