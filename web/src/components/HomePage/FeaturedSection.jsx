import { openOrderApp } from "@/utils/deviceDetection";

export function FeaturedSection() {
  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl">
          <img
            src="https://app.neobeirut.com/website/experience.jpg"
            alt="Featured Coffee"
            className="w-full h-[500px] object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center">
            <div className="text-white px-12 max-w-2xl">
              <h2 className="text-5xl md:text-6xl font-bold mb-4">
                Experience Excellence in Every Bite
              </h2>
              <p className="text-xl mb-6">
                From early morning croissants to evening bistro delights, every
                item we make is crafted with passion and served with love. We
                combine time-honored techniques with the finest ingredients to
                bring you authentic taste with a contemporary twist.
              </p>
              <button
                onClick={(e) => openOrderApp(e)}
                className="inline-block bg-[#2D5F5D] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#1f4342] transition-colors cursor-pointer"
              >
                Order Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
