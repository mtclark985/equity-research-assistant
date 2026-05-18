export function formatCurrency(value, unit) {
  if (value == null || isNaN(value)) return "\u2014";

  const abs = Math.abs(value);

  if (unit === "percent") {
    return value.toFixed(2) + "%";
  }

  if (unit === "USD/shares") {
    return "$" + value.toFixed(2);
  }

  // USD or shares — scale with suffix
  const sign = value < 0 ? "-" : "";
  const prefix = unit === "USD" ? "$" : "";

  if (abs >= 1e12) return sign + prefix + (abs / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return sign + prefix + (abs / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return sign + prefix + (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return sign + prefix + (abs / 1e3).toFixed(2) + "K";
  return sign + prefix + abs.toFixed(0);
}

export function formatDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
