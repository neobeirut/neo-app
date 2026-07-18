export function FeatureCard({ icon, title, description }) {
  return (
    <div className="text-center p-8 bg-[#F9F9F9] rounded-xl">
      <div className="w-16 h-16 bg-[#235b4e] rounded-full flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">{title}</h3>
      <p className="text-[#666666]">{description}</p>
    </div>
  );
}
