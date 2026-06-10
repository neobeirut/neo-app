"use client";

import { useState, useEffect } from "react";
import { MapPin, Phone, Clock } from "lucide-react";
import { openOrderApp } from "@/utils/deviceDetection";

export default function ContactPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function fetchBranches() {
      try {
        const response = await fetch("/api/branches");
        if (!response.ok) throw new Error("Failed to fetch branches");
        const data = await response.json();
        // Ensure we always set an array
        setBranches(Array.isArray(data) ? data : data.branches || []);
      } catch (error) {
        console.error("Error fetching branches:", error);
        setBranches([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    }

    fetchBranches();
  }, []);

  const formatTime = (time) => {
    if (!time) return "N/A";
    // Convert "09:00:00" to "9:00 AM"
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
    <div className="bg-white text-gray-900 min-h-screen font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative overflow-visible">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <a
              href="/"
              className="absolute -bottom-8 left-4 sm:left-6 lg:left-8 z-[60] hover:opacity-80 transition-opacity duration-300"
            >
              <img
                src="https://ucarecdn.com/07124162-e932-4dab-85f2-704f1fd1aad2/-/format/auto/"
                alt="Neo Beirut"
                className="h-24 w-auto rounded-lg"
              />
            </a>

            {/* Spacer for logo */}
            <div className="w-32"></div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="/#about"
                className="text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
              >
                About
              </a>
              <a
                href="/#catering"
                className="text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
              >
                Corporate Catering
              </a>
              <a
                href="/#menu"
                className="text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
              >
                Menu
              </a>
              <a
                href="/contact"
                className="text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
              >
                Contact
              </a>

              <button
                onClick={(e) => openOrderApp(e)}
                className="bg-[#2D5F5D] text-white px-6 py-3 font-semibold hover:bg-[#1f4342] transition-colors rounded-lg cursor-pointer"
              >
                Order Now
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#2D5F5D] p-2"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="flex flex-col gap-4">
                <a
                  href="/#about"
                  className="text-left text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
                >
                  About
                </a>
                <a
                  href="/#catering"
                  className="text-left text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
                >
                  Corporate Catering
                </a>
                <a
                  href="/#menu"
                  className="text-left text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
                >
                  Menu
                </a>
                <a
                  href="/contact"
                  className="text-left text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
                >
                  Contact
                </a>

                <button
                  onClick={(e) => openOrderApp(e)}
                  className="bg-[#2D5F5D] text-white px-6 py-3 font-semibold text-center hover:bg-[#1f4342] transition-colors rounded-lg cursor-pointer"
                >
                  Order Now
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 bg-gradient-to-br from-[#2D5F5D] to-[#1f4342]">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Visit Our Branches
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
            Find the Neo Beirut location nearest to you and experience our
            flavors in person
          </p>
        </div>
      </section>

      {/* Branches Section */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
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
                  <div className="relative h-64 overflow-hidden bg-gray-200">
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
                    <h2 className="text-2xl font-bold mb-4 text-[#2D5F5D]">
                      {branch.name}
                    </h2>

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
                      <Phone
                        size={20}
                        className="text-[#2D5F5D] flex-shrink-0"
                      />
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
                              Delivery: {formatTime(branch.delivery_start_time)}{" "}
                              - {formatTime(branch.delivery_end_time)}
                            </p>
                          )}
                      </div>
                    </div>

                    {/* Order Button */}
                    <button
                      onClick={(e) => openOrderApp(e)}
                      className="block w-full text-center bg-[#2D5F5D] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1f4342] transition-colors cursor-pointer"
                    >
                      Order from {branch.name}
                    </button>
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

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 px-4 bg-[#2D5F5D] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <img
                  src="https://ucarecdn.com/07124162-e932-4dab-85f2-704f1fd1aad2/-/format/auto/"
                  alt="Neo Beirut"
                  className="h-12 w-12 mr-3 bg-white rounded-lg p-1"
                />
                <div className="text-3xl font-bold">NEO BEIRUT</div>
              </div>
              <p className="text-gray-100">Flavors Worth Savoring</p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-xl">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/"
                    className="text-gray-100 hover:text-white transition-colors"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="/contact"
                    className="text-gray-100 hover:text-white transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
                <li>
                  <a
                    href="https://apps.apple.com/us/app/neo-beirut/id6758227724"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-100 hover:text-white transition-colors"
                  >
                    Order Online
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-xl">Follow Us</h4>
              <div className="flex gap-4">
                <a
                  href="https://www.facebook.com/Neobeirut"
                  className="w-10 h-10 bg-white text-[#2D5F5D] rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all font-bold"
                >
                  F
                </a>
                <a
                  href="https://www.instagram.com/neobeirut"
                  className="w-10 h-10 bg-white text-[#2D5F5D] rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all font-bold"
                >
                  I
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 text-center text-gray-100">
            <p>© {new Date().getFullYear()} Neo Beirut. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
