export default function StatCard({ icon, label, value, accent = "primary" }) {
  const accentClasses =
    accent === "secondary"
      ? "text-secondary bg-surface-container"
      : "text-primary bg-surface-container";

  return (
    <div className="flex items-center gap-space-sm p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentClasses}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div className="flex flex-col">
        <span className="font-headline-md text-headline-md text-on-surface leading-none">{value}</span>
        <span className="font-caption text-caption text-on-surface-variant mt-1">{label}</span>
      </div>
    </div>
  );
}
