import { useState } from "react";
import { Navigation } from "./Navigation";
import { MobileMenu } from "./MobileMenu";

export function Header({ scrollToSection }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleScrollToSection = (id) => {
    scrollToSection(id);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm overflow-visible">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative overflow-visible">
        <div className="flex justify-between items-center h-20">
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

          <div className="w-32"></div>

          <div className="hidden md:flex items-center gap-8">
            <Navigation scrollToSection={scrollToSection} />
          </div>

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

        <MobileMenu
          isOpen={mobileMenuOpen}
          scrollToSection={handleScrollToSection}
        />
      </div>
    </nav>
  );
}
