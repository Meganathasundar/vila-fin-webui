import { formatDate } from "@/utils/date";

interface DateDisplayProps {
  value: string | Date | null | undefined;
  className?: string;
}

export function DateDisplay({ value, className }: DateDisplayProps) {
  return <span className={className}>{formatDate(value)}</span>;
}
