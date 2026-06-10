import { Edit2, Trash2, GripVertical } from "lucide-react";
import { useState } from "react";

export function CategoriesTable({ categories, onEdit, onDelete, onReorder }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...categories];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setDraggedIndex(null);
    setDragOverIndex(null);

    if (onReorder) {
      onReorder(reordered);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Order
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Name
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Section
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Image
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Display Order
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Status
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {categories.map((category, index) => (
          <tr
            key={category.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`
              ${draggedIndex === index ? "opacity-50" : ""}
              ${dragOverIndex === index ? "border-t-2 border-blue-500" : ""}
              cursor-move hover:bg-gray-50 transition-colors
            `}
          >
            <td className="px-6 py-4">
              <GripVertical size={20} className="text-gray-400" />
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">{category.name}</td>
            <td className="px-6 py-4">
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  category.section === "Store"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-orange-100 text-orange-800"
                }`}
              >
                {category.section || "Store"}
              </span>
            </td>
            <td className="px-6 py-4">
              <img
                src={category.image_url}
                alt={category.name}
                className="w-12 h-12 object-cover rounded"
              />
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">
              {category.display_order}
            </td>
            <td className="px-6 py-4">
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  category.is_active
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {category.is_active ? "Active" : "Inactive"}
              </span>
            </td>
            <td className="px-6 py-4 text-sm">
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(category)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onDelete(category.id, "categories")}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
