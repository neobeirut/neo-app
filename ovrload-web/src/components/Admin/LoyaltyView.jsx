import { CreditCard, TrendingUp } from "lucide-react";

export function LoyaltyView({ users, loyaltyTransactions }) {
  return (
    <div>
      {/* Users Table */}
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CreditCard size={20} />
          User Loyalty Status
        </h3>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                User
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Points
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Total Spent
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {user.name || user.email}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {user.points || 0}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      user.membership_tier === "Platinum"
                        ? "bg-purple-100 text-purple-800"
                        : user.membership_tier === "Gold"
                          ? "bg-yellow-100 text-yellow-800"
                          : user.membership_tier === "Silver"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {user.membership_tier || "Bronze"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  ${user.total_spent || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Transactions */}
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Recent Loyalty Transactions
        </h3>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                User
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Type
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Points
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Description
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loyaltyTransactions.slice(0, 10).map((transaction, index) => (
              <tr key={index}>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {transaction.user_email}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      transaction.transaction_type === "redeemed"
                        ? "bg-red-100 text-red-800"
                        : transaction.transaction_type === "earned"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {transaction.transaction_type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {transaction.points > 0 ? "+" : ""}
                  {transaction.points}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {transaction.description}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(transaction.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
