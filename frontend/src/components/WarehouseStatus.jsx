import { getOpenStatus, summarizeHours } from "../utils/warehouseHours";

// "Open now" / "Closed" pill. Renders nothing when no hours have been set.
// showDetail adds the "Closes 5:00 PM" / "Opens tomorrow 9:00 AM" line.
export function OpenBadge({ openingHours, showDetail = false }) {
  const status = getOpenStatus(openingHours);
  if (!status.known) return null;

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-caption text-caption ${status.open
            ? "bg-status-confirmed/10 text-status-confirmed"
            : "bg-surface-container-high text-on-surface-variant"
          }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${status.open ? "bg-status-confirmed" : "bg-on-surface-variant/50"}`}
        />
        {status.label}
      </span>
      {showDetail && <span className="font-caption text-caption text-on-surface-variant">{status.detail}</span>}
    </span>
  );
}

// Usage bar for a warehouse that has a capacity. `warehouse` is the object
// the API returns (capacity, stockTotal, percentFull, spaceLeft, isFull).
// Renders nothing when there is no capacity limit.
export function CapacityBar({ warehouse, className = "" }) {
  const { capacity, stockTotal = 0, percentFull = 0, spaceLeft = 0, isFull } = warehouse || {};
  if (!capacity) return null;

  const barColor = isFull ? "bg-status-critical" : percentFull >= 75 ? "bg-status-pending" : "bg-status-confirmed";

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-space-sm font-caption text-caption text-on-surface-variant mb-1">
        <span className={isFull ? "text-status-critical" : ""}>
          {isFull ? "Full" : `${spaceLeft} units of space left`}
        </span>
        <span>
          {stockTotal} / {capacity}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full bg-surface-container-high overflow-hidden"
        role="progressbar"
        aria-valuenow={percentFull}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentFull}%` }} />
      </div>
    </div>
  );
}

// Compact weekly summary: "Sun - Fri  9:00 AM - 5:00 PM" / "Sat  Closed".
export function HoursList({ openingHours }) {
  const rows = summarizeHours(openingHours);
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {rows.map((r) => (
        <div key={r.days} className="flex items-center justify-between gap-space-sm font-caption text-caption">
          <span className="text-on-surface-variant">{r.days}</span>
          <span className="text-on-surface">{r.label}</span>
        </div>
      ))}
    </div>
  );
}