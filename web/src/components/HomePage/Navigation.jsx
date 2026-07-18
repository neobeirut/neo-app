import { openOrderApp } from "@/utils/deviceDetection";

export function Navigation({ scrollToSection }) {
  return (
    <>
      <button
        onClick={() => scrollToSection("about")}
        className="text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
      >
        About
      </button>
      <button
        onClick={() => scrollToSection("catering")}
        className="text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
      >
        Corporate Catering
      </button>
      <button
        onClick={() => scrollToSection("menu")}
        className="text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
      >
        Menu
      </button>
      <button
        onClick={() => scrollToSection("contact")}
        className="text-gray-700 hover:text-[#2D5F5D] transition-colors font-medium"
      >
        Contact
      </button>

      <button
        onClick={(e) => openOrderApp(e)}
        className="bg-[#2D5F5D] text-white px-6 py-3 font-semibold hover:bg-[#1f4342] transition-colors rounded-lg cursor-pointer"
      >
        Order Now
      </button>
    </>
  );
}
