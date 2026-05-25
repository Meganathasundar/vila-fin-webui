/**
 * LookupSelectField — reusable dropdown for x-field-type: lookup fields.
 *
 * Options are sourced from useLookupOptions which reads from localStorage and
 * only calls the API when the lookup version increments (never on every render).
 *
 * The submitted value is the UUID of the lookup value (id field).
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLookupOptions } from "@/hooks/useLookupOptions";

// Sentinel used internally to represent "no selection" in the Select component
const NONE_VALUE = "__none__";

interface LookupSelectFieldProps {
  /** The x-lookup-list value from the spec (e.g. "garage", "vehicle_consultancy") */
  listCode: string;
  /** Current UUID value (or undefined / null for no selection) */
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Whether to include a "— None —" option (default: true) */
  allowNone?: boolean;
  disabled?: boolean;
  className?: string;
}

export function LookupSelectField({
  listCode,
  value,
  onChange,
  placeholder = "Select…",
  allowNone = true,
  disabled = false,
  className,
}: LookupSelectFieldProps) {
  const { options, isLoading } = useLookupOptions(listCode);

  const selectValue = value ?? NONE_VALUE;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? "Loading…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value={NONE_VALUE}>
            <span className="text-muted-foreground">— None —</span>
          </SelectItem>
        )}
        {!isLoading && options.length === 0 && (
          <SelectItem value="__empty__" disabled>
            No values configured
          </SelectItem>
        )}
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.label}
            {opt.meta && (opt.meta as Record<string, string>).city && (
              <span className="text-muted-foreground ml-1 text-xs">
                — {(opt.meta as Record<string, string>).city}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
