// Design-system rule: "Status pills: small colored dot + short label, used
// consistently everywhere a state is shown." Colors match the SaajhaRahat
// prompt exactly: green Confirmed/Resolved, amber Pending/Under Review,
// gray Draft/Idle, red Critical/Duplication Alert.
const STATUS_STYLES = {
  confirmed: { dot: "bg-status-confirmed", text: "text-status-confirmed", label: "Confirmed" },
  possible_duplicate: { dot: "bg-status-critical", text: "text-status-critical", label: "Possible Duplicate" },
  pending: { dot: "bg-status-pending", text: "text-status-pending", label: "Pending" },
  confirmed_alert: { dot: "bg-status-critical", text: "text-status-critical", label: "Confirmed" },
  dismissed: { dot: "bg-status-idle", text: "text-status-idle", label: "Dismissed" },
  open: { dot: "bg-status-pending", text: "text-status-pending", label: "Open" },
  addressed: { dot: "bg-status-confirmed", text: "text-status-confirmed", label: "Addressed" },
  low: { dot: "bg-status-idle", text: "text-status-idle", label: "Low" },
  medium: { dot: "bg-status-pending", text: "text-status-pending", label: "Medium" },
  urgent: { dot: "bg-status-critical", text: "text-status-critical", label: "Urgent" },
};

export default function StatusPill({ status, label }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low border border-surface-container-highest">
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      <span className={`font-label-sm text-label-sm ${style.text}`}>{label || style.label}</span>
    </span>
  );
}
