import { openOrderApp } from "@/utils/deviceDetection";

export function MobileMenu({ isOpen, scrollToSection }) {
  if (!isOpen) return null;

  return (
    <div className="md:hidden py-4 border-t border-gray-200">
      <div className="flex flex-col gap-4">
        <button
          onClick={() => scrollToSection("about")}
          className="text-left text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
        >
          About
        </button>
        <button
          onClick={() => scrollToSection("catering")}
          className="text-left text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
        >
          Catering
        </button>
        <button
          onClick={() => scrollToSection("menu")}
          className="text-left text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
        >
          Menu
        </button>
        <button
          onClick={() => scrollToSection("contact")}
          className="text-left text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
        >
          Contact
        </button>

        <button
          onClick={(e) => openOrderApp(e)}
          className="bg-[#2D5F5D] text-white px-6 py-3 font-semibold text-center hover:bg-[#1f4342] transition-colors rounded-lg cursor-pointer"
        >
          Order Now
        </button>
      </div>
    </div>
  );
}
