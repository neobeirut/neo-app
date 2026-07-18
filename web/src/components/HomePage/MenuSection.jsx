import { useState } from "react";
import { MenuCard } from "./MenuCard";
import { bistro, coffee, pastries, bakery } from "./menuData";

export function MenuSection() {
  const [activeMenu, setActiveMenu] = useState("bistro");

  const menuItems = {
    bistro,
    coffee,
    pastries,
    bakery,
  };

  return (
    <section id="menu" className="py-24 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold mb-8 text-[#2D5F5D]">
            Our Menu
          </h2>
          <div className="flex justify-center gap-4 mb-12 flex-wrap">
            <button
              onClick={() => setActiveMenu("bistro")}
              className={`px-8 py-3 border-2 font-semibold transition-all rounded-lg ${
                activeMenu === "bistro"
                  ? "bg-[#2D5F5D] text-white border-[#2D5F5D]"
                  : "border-[#2D5F5D] text-[#2D5F5D] hover:bg-[#2D5F5D] hover:text-white"
              }`}
            >
              Bistro
            </button>
            <button
              onClick={() => setActiveMenu("coffee")}
              className={`px-8 py-3 border-2 font-semibold transition-all rounded-lg ${
                activeMenu === "coffee"
                  ? "bg-[#2D5F5D] text-white border-[#2D5F5D]"
                  : "border-[#2D5F5D] text-[#2D5F5D] hover:bg-[#2D5F5D] hover:text-white"
              }`}
            >
              Coffees
            </button>
            <button
              onClick={() => setActiveMenu("pastries")}
              className={`px-8 py-3 border-2 font-semibold transition-all rounded-lg ${
                activeMenu === "pastries"
                  ? "bg-[#2D5F5D] text-white border-[#2D5F5D]"
                  : "border-[#2D5F5D] text-[#2D5F5D] hover:bg-[#2D5F5D] hover:text-white"
              }`}
            >
              Pastries
            </button>
            <button
              onClick={() => setActiveMenu("bakery")}
              className={`px-8 py-3 border-2 font-semibold transition-all rounded-lg ${
                activeMenu === "bakery"
                  ? "bg-[#2D5F5D] text-white border-[#2D5F5D]"
                  : "border-[#2D5F5D] text-[#2D5F5D] hover:bg-[#2D5F5D] hover:text-white"
              }`}
            >
              Bakery
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {menuItems[activeMenu]?.map((item, index) => (
            <MenuCard key={index} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
