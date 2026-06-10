import { WEEKDAYS } from "./constants";

export function RecurrenceSection({
  isRecurring,
  setIsRecurring,
  recurrenceByWeekday,
  setRecurrenceByWeekday,
  recurrenceInterval,
  setRecurrenceInterval,
  recurrenceUntil,
  setRecurrenceUntil,
  endAt,
}) {
  const toggleWeekday = (code) => {
    setRecurrenceByWeekday((prev) => {
      const has = prev.includes(code);
      if (has) return prev.filter((c) => c !== code);
      return [...prev, code];
    });
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">Recurring</div>
          <div className="text-xs text-gray-500">
            Use this for events that happen every Thursday / every weekend.
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => {
              const next = e.target.checked;
              setIsRecurring(next);
              if (!next) {
                setRecurrenceByWeekday([]);
                setRecurrenceUntil("");
                setRecurrenceInterval("1");
              }
            }}
          />
          Recurring weekly
        </label>
      </div>

      {isRecurring ? (
        <div className="mt-4 space-y-4">
          <div className="text-sm text-gray-600">
            The time comes from <span className="font-medium">Start at</span>
            {endAt ? (
              <>
                {" "}
                and the duration comes from{" "}
                <span className="font-medium">End at</span>.
              </>
            ) : (
              <>
                . (If you add an End at, each occurrence will also have an end
                time.)
              </>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Days of week *
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const active = recurrenceByWeekday.includes(d.code);
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => toggleWeekday(d.code)}
                    className={`px-3 py-1.5 rounded-full border text-sm ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repeat every (weeks)
              </label>
              <input
                type="number"
                min="1"
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End repeat (optional)
              </label>
              <input
                type="date"
                value={recurrenceUntil}
                onChange={(e) => setRecurrenceUntil(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <div className="mt-1 text-xs text-gray-500">
                If blank, we'll show upcoming occurrences in the app.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
