export function CateringFeature({ icon, title, description }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="w-12 h-12 bg-[#235b4e] rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div>
        <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">{title}</h3>
        <p className="text-[#666666]">{description}</p>
      </div>
    </div>
  );
}
