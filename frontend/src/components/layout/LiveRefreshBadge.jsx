export function LiveRefreshBadge() {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"
      title="Refreshes every 10 seconds and whenever you return to this tab"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      Live · 10s
    </span>
  );
}
