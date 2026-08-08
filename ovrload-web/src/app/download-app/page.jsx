"use client";

import { Smartphone, Apple } from "lucide-react";

export default function DownloadAppPage() {
  return (
    <div className="bg-gradient-to-br from-[#2D5F5D] to-[#1f4342] text-white min-h-screen font-sans flex items-center justify-center">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="https://ucarecdn.com/07124162-e932-4dab-85f2-704f1fd1aad2/-/format/auto/"
            alt="Neo Beirut"
            className="h-32 w-32 mx-auto rounded-2xl shadow-2xl"
          />
        </div>

        {/* Main Heading */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          Order on the Go!
        </h1>

        {/* Subheading */}
        <p className="text-xl md:text-2xl mb-4 text-white/90 max-w-2xl mx-auto">
          For the best ordering experience, please download the{" "}
          <span className="font-bold">Néo Beirut</span> app on your phone.
        </p>

        <p className="text-lg md:text-xl mb-12 text-white/80 max-w-xl mx-auto">
          Available on iPhone and Android devices
        </p>

        {/* App Download Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
          {/* App Store Button */}
          <a
            href="https://apps.apple.com/us/app/neo-beirut/id6758227724"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 bg-black hover:bg-gray-900 text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 w-full sm:w-auto"
          >
            <Apple size={40} className="flex-shrink-0" />
            <div className="text-left">
              <div className="text-xs opacity-90">Download on the</div>
              <div className="text-xl font-bold">App Store</div>
            </div>
          </a>

          {/* Google Play Button */}
          <a
            href="https://play.google.com/store/apps/details?id=com.neobeirut.app&hl=en"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 bg-black hover:bg-gray-900 text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 w-full sm:w-auto"
          >
            <Smartphone size={40} className="flex-shrink-0" />
            <div className="text-left">
              <div className="text-xs opacity-90">GET IT ON</div>
              <div className="text-xl font-bold">Google Play</div>
            </div>
          </a>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-16 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
            <div className="text-4xl mb-3">🛒</div>
            <h3 className="text-xl font-bold mb-2">Easy Ordering</h3>
            <p className="text-white/80">
              Browse our menu and order in seconds
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
            <div className="text-4xl mb-3">🚚</div>
            <h3 className="text-xl font-bold mb-2">Fast Delivery</h3>
            <p className="text-white/80">Track your order in real-time</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
            <div className="text-4xl mb-3">🎁</div>
            <h3 className="text-xl font-bold mb-2">Exclusive Rewards</h3>
            <p className="text-white/80">Earn points with every order</p>
          </div>
        </div>

        {/* Back to Website Link */}
        <div className="mt-16">
          <a
            href="/"
            className="inline-block text-white/80 hover:text-white underline text-lg transition-colors"
          >
            ← Back to Website
          </a>
        </div>
      </div>
    </div>
  );
}
