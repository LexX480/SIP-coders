const LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "urgent", label: "Urgent" },
];

const ACTIVE_STYLES = {
  low: "bg-status-idle text-white border-status-idle",
  medium: "bg-status-pending text-white border-status-pending",
  urgent: "bg-status-critical text-white border-status-critical",
};

export default function UrgencyPills({ value, onChange }) {
  return (
    <div className="flex gap-space-sm">
      {LEVELS.map((level) => {
        const active = value === level.value;
        return (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={`flex-1 py-2.5 rounded-full border font-label-md text-label-md transition-colors ${
              active
                ? ACTIVE_STYLES[level.value]
                : "border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}
