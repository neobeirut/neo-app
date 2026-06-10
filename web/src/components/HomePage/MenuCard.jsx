export function MenuCard({ item }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer">
      <div className="relative overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-bold text-gray-900">{item.name}</h3>
          <span className="text-2xl font-bold text-[#2D5F5D]">
            {item.price}
          </span>
        </div>

        <p className="text-sm text-gray-600">{item.desc}</p>
      </div>
    </div>
  );
}
