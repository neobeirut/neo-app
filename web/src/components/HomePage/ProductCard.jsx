export function ProductCard({ icon, title, description, bgGradient }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300">
      <div
        className={`aspect-[4/3] bg-gradient-to-br ${bgGradient} flex items-center justify-center`}
      >
        {icon}
      </div>
      <div className="p-6 bg-white">
        <h3 className="text-2xl font-bold text-[#235b4e] mb-3">{title}</h3>
        <p className="text-[#666666] mb-4">{description}</p>
        <a
          href="/shop"
          className="inline-flex items-center text-[#235b4e] font-medium hover:text-[#2B6B5C] transition-colors"
        >
          Explore {title}
          <svg
            className="w-5 h-5 ml-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
