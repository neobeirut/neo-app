import { ProductCard } from "./ProductCard";

export function ProductsSection() {
  const products = [
    {
      icon: (
        <svg
          className="w-24 h-24 text-[#235b4e]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z"
          />
        </svg>
      ),
      title: "Pastry",
      description:
        "Exquisite pastries from croissants to éclairs, each a masterpiece of flavor and texture",
      bgGradient: "from-[#F0F5F3] to-[#E0E0E0]",
      iconColor: "text-[#235b4e]",
    },
    {
      icon: (
        <svg
          className="w-24 h-24 text-[#B8935A]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
          />
        </svg>
      ),
      title: "Bakery",
      description:
        "Fresh-baked breads, rolls, and specialty items made daily with traditional methods",
      bgGradient: "from-[#FDF8F0] to-[#E0E0E0]",
      iconColor: "text-[#B8935A]",
    },
    {
      icon: (
        <svg
          className="w-24 h-24 text-[#235b4e]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      title: "Bistro",
      description:
        "Gourmet meals and café favorites, perfect for any time of day",
      bgGradient: "from-[#F4F0E8] to-[#E0E0E0]",
      iconColor: "text-[#235b4e]",
    },
  ];

  return (
    <section id="products" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-[#235b4e] mb-4">
            Our Products
          </h2>
          <div className="w-24 h-1 bg-[#B8935A] mx-auto mb-6"></div>
          <p className="text-lg text-[#666666] max-w-3xl mx-auto">
            Discover our range of artisanal products, each crafted with
            expertise and love
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <ProductCard key={index} {...product} />
          ))}
        </div>
      </div>
    </section>
  );
}
