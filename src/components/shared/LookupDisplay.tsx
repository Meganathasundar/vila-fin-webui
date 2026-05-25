/**
 * LookupDisplay — resolves a lookup code to its display label.
 *
 * Reads from LookupContext (localStorage bulk cache). No API call.
 *
 * Usage:
 *   <LookupDisplay listCode="garage" id={row.garage_id} />
 */

import { useLookups } from "@/context/LookupContext";

interface LookupDisplayProps {
  listCode: string;
  id?: string | null;
  fallback?: string;
  className?: string;
}

export function LookupDisplay({
  listCode,
  id,
  fallback = "—",
  className,
}: LookupDisplayProps) {
  const { getLookupLabel } = useLookups();

  if (!id) return <span className={className}>{fallback}</span>;

  const label = getLookupLabel(listCode, id);
  // getLookupLabel returns the code itself when not found — treat code === id as "not found"
  return <span className={className}>{label !== id ? label : fallback}</span>;
}
