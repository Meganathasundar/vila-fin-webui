import { format, parseISO } from "date-fns";

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? parseISO(value) : value;
    return format(date, "dd-MM-yyyy");
  } catch {
    return "—";
  }
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? parseISO(value) : value;
    return format(date, "dd-MM-yyyy HH:mm");
  } catch {
    return "—";
  }
}

export function toISODate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}
