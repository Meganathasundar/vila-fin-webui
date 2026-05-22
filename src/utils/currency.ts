export function formatINR(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

export function parseINR(value: string): number {
  return parseFloat(value.replace(/[^0-9.]/g, "")) || 0;
}
