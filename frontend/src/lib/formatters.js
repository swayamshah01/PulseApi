export function formatDateTime(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatInterval(seconds) {
  if (seconds % 3600 === 0) return `${seconds / 3600} hr`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} sec`;
}

export function healthLabel(isUp) {
  if (isUp === true) return "Up";
  if (isUp === false) return "Down";
  return "Not Checked";
}

export function healthClass(isUp) {
  if (isUp === true) return "bg-emerald-400/15 text-emerald-300";
  if (isUp === false) return "bg-rose-400/15 text-rose-300";
  return "bg-slate-700 text-slate-300";
}
