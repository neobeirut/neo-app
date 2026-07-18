"use client";

import { ChevronUp, ChevronDown } from "lucide-react";

export function BranchesTable({ branches, onEdit, onDelete, onReorder }) {
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newBranches = [...branches];
    [newBranches[index - 1], newBranches[index]] = [
      newBranches[index],
      newBranches[index - 1],
    ];
    onReorder(newBranches);
  };

  const handleMoveDown = (index) => {
    if (index === branches.length - 1) return;
    const newBranches = [...branches];
    [newBranches[index], newBranches[index + 1]] = [
      newBranches[index + 1],
      newBranches[index],
    ];
    onReorder(newBranches);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              Sort Order
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Address
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Phone
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Delivery Radius
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {branches.map((branch, index) => (
            <tr key={branch.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className={`p-0.5 rounded ${
                        index === 0
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-blue-600 hover:bg-blue-50"
                      }`}
                      title="Move up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === branches.length - 1}
                      className={`p-0.5 rounded ${
                        index === branches.length - 1
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-blue-600 hover:bg-blue-50"
                      }`}
                      title="Move down"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  <span className="text-sm text-gray-600 font-medium">
                    #{index + 1}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {branch.name}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900 max-w-xs truncate">
                  {branch.address || "No address"}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {branch.phone || "No phone"}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {branch.delivery_radius_km === null ||
                  branch.delivery_radius_km === undefined
                    ? "—"
                    : `${Number(branch.delivery_radius_km).toFixed(1)} km`}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    branch.is_active
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {branch.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => onEdit(branch)}
                  className="text-indigo-600 hover:text-indigo-900 mr-4"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(branch.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {branches.length === 0 && (
        <div className="text-center py-8 text-gray-500">No branches found</div>
      )}
    </div>
  );
}
