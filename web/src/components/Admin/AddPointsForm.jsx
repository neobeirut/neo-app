import { useState } from "react";
import { Gift } from "lucide-react";

export function AddPointsForm({ users, onAddPoints }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedUserId && points && description) {
      onAddPoints(selectedUserId, points, description);
      setSelectedUserId("");
      setPoints("");
      setDescription("");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-4">Add Points to User</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="border rounded px-3 py-2 text-gray-900"
          required
        >
          <option value="" className="text-gray-400">
            Select User
          </option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name || user.email} ({user.points || 0} points)
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Points to add"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className="border rounded px-3 py-2 placeholder:text-gray-400"
          required
        />
        <input
          type="text"
          placeholder="Description (e.g., Test purchase - $15.00)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border rounded px-3 py-2 col-span-2 placeholder:text-gray-400"
          required
        />
        <button
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 col-span-2"
        >
          <Gift className="inline mr-2" size={16} />
          Add Points
        </button>
      </form>
    </div>
  );
}
