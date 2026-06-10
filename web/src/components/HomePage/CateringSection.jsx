import { CateringCard } from "./CateringCard";

const blogs = [
  {
    title: "Executive Breakfast Trays",
    date: "29 May, 2024",
    image: "https://app.neobeirut.com/website/executive-breakfast-trays.jpg",
    excerpt:
      "Freshly baked croissants, mini viennoiseries, artisanal breads, seasonal fruit, and premium coffee.",
  },
  {
    title: "Business Lunch Boxes",
    date: "29 May, 2024",
    image: "https://app.neobeirut.com/website/lunch-box.jpg",
    excerpt:
      "Chef-crafted sandwiches, salads, daily specials, and balanced gourmet options — individually packed and beautifully presented.",
  },
  {
    title: "Coffee Break Packages",
    date: "29 May, 2024",
    image: "https://app.neobeirut.com/website/coffee-break.jpg",
    excerpt:
      "Sweet and savory assortments paired with specialty coffee and beverages.",
  },
  {
    title: "Custom Event for cold Catering",
    date: "29 May, 2024",
    image: "https://app.neobeirut.com/website/catering.jpg",
    excerpt:
      "Elegant cold platters and canapés tailored to your event — beautifully presented, ready to serve.",
  },
  {
    title: "Custom Event for hot Catering",
    date: "29 May, 2024",
    image: "https://app.neobeirut.com/website/catering-hot.jpg",
    excerpt:
      "Chef-prepared hot dishes crafted for your event — served fresh, elegant, and full of flavor.",
  },
  {
    title: "Download our Corporate Brochure",
    date: "29 May, 2024",
    image: "https://app.neobeirut.com/website/corporate-brochure.jpg",
    excerpt:
      "Explore our curated catering packages, menu options, and service details — thoughtfully designed for meetings, events, and corporate gatherings.",
    href: "https://app.neobeirut.com/Neo_Beirut_Corporate_Catering_2025.pdf",
  },
];

export function CateringSection() {
  return (
    <section id="catering" className="py-24 px-4 border-t border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold mb-4 text-[#2D5F5D]">
            Corporate Catering
          </h2>
          <div className="h-1 w-32 bg-[#2D5F5D] mx-auto"></div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogs.map((blog, index) => (
            <CateringCard key={index} blog={blog} />
          ))}
        </div>
      </div>
    </section>
  );
}
