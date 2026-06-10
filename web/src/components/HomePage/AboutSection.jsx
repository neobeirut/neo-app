export function AboutSection() {
  return (
    <section id="about" className="py-24 px-4 border-t border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="mb-8">
              <h2 className="text-5xl md:text-6xl font-bold mb-4 text-[#2D5F5D]">
                Our Story
              </h2>
              <div className="h-1 w-32 bg-[#2D5F5D]"></div>
            </div>
            <p className="text-lg mb-6 text-gray-600 leading-relaxed">
              Founded with a love for quality and a passion for taste, Néo
              Beirut celebrates the vibrant culinary heritage of Beirut with a
              French-inspired touch. Our journey began with a simple mission —
              to bake exceptional breads, pastries, and dishes that make
              everyday moments special. At Néo Beirut, every recipe has a story,
              and every bite is an invitation to experience joy.
            </p>
            <div className="inline-block px-6 py-3 border-2 border-[#2D5F5D] font-bold text-lg text-[#2D5F5D] hover:bg-[#2D5F5D] hover:text-white transition-all cursor-pointer rounded-lg">
              Our Story
            </div>
          </div>
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800"
              alt="Coffee"
              className="rounded-2xl shadow-2xl w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
