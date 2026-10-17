import { DAYS, allDayHours, findHoursError, isAllDayWeek, normalizeHours, uniformHours } from "../utils/warehouseHours";

const MODES = [
  { value: "none", label: "Not set" },
  { value: "24h", label: "Open 24 hours" },
  { value: "custom", label: "Set hours" },
];

const TIME_INPUT =
  "h-9 w-[112px] px-2 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors";

// value: [] (hours not set) or an array of { day, closed, open, close }.
// Calls onChange with the same shape, so it can be sent to the API as-is.
export default function OpeningHoursEditor({ value, onChange }) {
  const hours = Array.isArray(value) ? value : [];
  const mode = hours.length === 0 ? "none" : isAllDayWeek(hours) ? "24h" : "custom";
  const week = normalizeHours(hours);
  const problem = findHoursError(hours);

  function selectMode(next) {
    if (next === mode) return;
    if (next === "none") onChange([]);
    else if (next === "24h") onChange(allDayHours());
    else onChange(uniformHours());
  }

  function updateDay(dayIndex, patch) {
    onChange(week.map((e) => (e.day === dayIndex ? { ...e, ...patch } : e)));
  }

  function applyToAll(source) {
    onChange(week.map((e) => ({ ...e, closed: source.closed, open: source.open, close: source.close })));
  }

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="inline-flex self-start rounded-lg bg-surface-container p-0.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={mode === m.value}
            onClick={() => selectMode(m.value)}
            className={`h-9 px-3 rounded-md font-label-sm text-label-sm whitespace-nowrap transition-colors ${mode === m.value
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
              }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "none" && (
        <p className="font-caption text-caption text-on-surface-variant">
          No opening times are shown. Donors will see this location without hours.
        </p>
      )}

      {mode === "24h" && (
        <p className="font-caption text-caption text-on-surface-variant">
          Open every day, around the clock - handy for emergency drop-off points.
        </p>
      )}

      {mode === "custom" && (
        <>
          <div className="flex flex-col divide-y divide-surface-container-highest rounded-lg border border-surface-container-highest">
            {week.map((e) => (
              <div key={e.day} className="flex items-center gap-space-sm px-space-sm py-2 flex-wrap">
                <span className="w-10 font-label-sm text-label-sm text-on-surface">{DAYS[e.day].short}</span>
                <label className="flex items-center gap-1.5 w-[72px] font-caption text-caption text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={e.closed}
                    onChange={(ev) => updateDay(e.day, { closed: ev.target.checked })}
                    className="accent-primary"
                  />
                  Closed
                </label>
                {!e.closed && (
                  <>
                    <input
                      type="time"
                      value={e.open}
                      onChange={(ev) => updateDay(e.day, { open: ev.target.value })}
                      className={TIME_INPUT}
                      aria-label={`${DAYS[e.day].label} opens`}
                    />
                    <span className="font-caption text-caption text-on-surface-variant">to</span>
                    <input
                      type="time"
                      value={e.close}
                      onChange={(ev) => updateDay(e.day, { close: ev.target.value })}
                      className={TIME_INPUT}
                      aria-label={`${DAYS[e.day].label} closes`}
                    />
                    <button
                      type="button"
                      onClick={() => applyToAll(e)}
                      title="Use these hours for every day"
                      className="ml-auto w-8 h-8 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {problem && <p className="font-caption text-caption text-status-critical">{problem}</p>}
          <p className="font-caption text-caption text-on-surface-variant">
            Times are Nepal local time. Use the copy button on a row to apply its hours to every day.
          </p>
        </>
      )}
    </div>
  );
}