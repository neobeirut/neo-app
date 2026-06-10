export function ReservationSection({
  reservationRequired,
  setReservationRequired,
  showInReservationTab,
  setShowInReservationTab,
  reservationUrl,
  setReservationUrl,
  reservationPhone,
  setReservationPhone,
  price,
  setPrice,
  currency,
  setCurrency,
  capacity,
  setCapacity,
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-900">Reservation</div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={reservationRequired}
            onChange={(e) => {
              const next = e.target.checked;
              setReservationRequired(next);
              if (!next) {
                setShowInReservationTab(false);
              }
            }}
          />
          Required
        </label>
      </div>

      {reservationRequired ? (
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showInReservationTab}
              onChange={(e) => setShowInReservationTab(e.target.checked)}
            />
            Show in Reservation tab
          </label>
          <div className="text-xs text-gray-500">
            Leave unchecked until your reservation link/phone is live.
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reservation URL
          </label>
          <input
            value={reservationUrl}
            onChange={(e) => setReservationUrl(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reservation phone
          </label>
          <input
            value={reservationPhone}
            onChange={(e) => setReservationPhone(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="+961..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price
          </label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="USD, LBP, ..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Capacity
          </label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {reservationRequired &&
      showInReservationTab &&
      !reservationUrl &&
      !reservationPhone ? (
        <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          When shown in the reservation tab, you must set a URL or phone.
        </div>
      ) : null}
    </div>
  );
}
