import { ChevronRight } from "lucide-react";

export function CateringCard({ blog }) {
  const Card = (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all group cursor-pointer">
      <div className="relative overflow-hidden">
        <img
          src={blog.image}
          alt={blog.title}
          className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold mb-3 line-clamp-2 text-gray-900">
          {blog.title}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-3">{blog.excerpt}</p>

        {blog.href && (
          <div className="mt-5 inline-flex items-center gap-2 text-[#2D5F5D] font-semibold">
            Download brochure <ChevronRight size={18} />
          </div>
        )}
      </div>
    </div>
  );

  return blog.href ? (
    <a
      href={blog.href}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      {Card}
    </a>
  ) : (
    <div>{Card}</div>
  );
}
