import { TestimonialCard } from "./TestimonialCard";

const testimonials = [
  {
    name: "Sarah O.",
    text: "I was in Badaro and grabbed un pain au chocolat aux amandes ✅ Super duper, succulent 😋 Heavenly 👏🏻",
  },
  {
    name: "Lamis G.",
    text: "Nice boulangerie, pastry, restaurant in Badaro where you can hang at the terrace especially on a sunny pleasant day. They present very well their coffees. A good new address in Badaro",
  },
  {
    name: "Dania B.",
    text: "On a passé un moment excellent grâce à un accueil très chaleureux et des plats succulents. Merci Carmen merci toute l'équipe.",
  },
  {
    name: "Ghada S.",
    text: "It's a lovely place with excellent presentation and a friendly, welcoming team. The sandwiches, desserts, and coffee were all great, and the manager, Fares, even stopped by our table to make sure everything was perfect.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 px-4 border-t border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index} testimonial={testimonial} />
          ))}
        </div>
      </div>
    </section>
  );
}
