import { formatINR } from "@/utils/currency";

interface CurrencyDisplayProps {
  value: number | string | null | undefined;
  className?: string;
}

export function CurrencyDisplay({ value, className }: CurrencyDisplayProps) {
  if (value === null || value === undefined) return <span className={className}>—</span>;
  return <span className={className}>{formatINR(value)}</span>;
}
