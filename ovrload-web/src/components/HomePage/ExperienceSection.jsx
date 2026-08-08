export function ExperienceSection() {
  return (
    <section className="py-24 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative order-2 md:order-1">
            <img
              src="https://app.neobeirut.com/website/reviews.jpg"
              alt="Coffee Experience"
              className="rounded-2xl shadow-2xl w-full"
            />
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 text-[#2D5F5D]">
              Delightful Reviews
            </h2>
            <div className="h-1 w-32 bg-[#2D5F5D] mb-8"></div>
            <p className="text-lg text-gray-600 leading-relaxed">
              What Our Guests Are Saying
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
