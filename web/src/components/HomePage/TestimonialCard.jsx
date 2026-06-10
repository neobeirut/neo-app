import { Star } from "lucide-react";

export function TestimonialCard({ testimonial }) {
  return (
    <div className="bg-white border border-gray-200 p-6 rounded-xl hover:shadow-lg transition-all">
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={20} fill="#2D5F5D" color="#2D5F5D" />
        ))}
      </div>
      <p className="text-gray-600 mb-4 italic">{testimonial.text}</p>
      <p className="font-bold text-gray-900">{testimonial.name}</p>
    </div>
  );
}
