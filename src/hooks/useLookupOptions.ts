/**
 * useLookupOptions — resolves x-field-type: lookup dropdown options.
 *
 * Reads directly from LookupContext (bulk lookup_data bootstrapped at app load
 * from GET /api/v1/lookups). No per-list API call is made.
 *
 * The value submitted to the backend is the lookup value's `code`
 * (e.g. "agaram_consulting") — matching what the backend stores and returns
 * for fields like garage_id, consultancy_id, etc.
 *
 * Options re-derive automatically when lookupVersion increments (background refresh).
 */

import { useMemo } from "react";
import { useLookups } from "@/context/LookupContext";

export interface LookupOptionItem {
  /** Code value sent to / received from the backend (e.g. "agaram_consulting") */
  id: string;
  code: string;
  label: string;
  meta?: Record<string, unknown> | null;
  sort_order?: number;
}

interface UseLookupOptionsResult {
  options: LookupOptionItem[];
  isLoading: boolean;
}

/**
 * Returns dropdown options for a lookup field.
 * Pass the value from x-lookup-list in the spec (e.g. "garage", "vehicle_consultancy").
 *
 * @example
 *   const { options } = useLookupOptions("garage");
 *   // options: [{ id: "agaram_consulting", code: "agaram_consulting", label: "Agaram Consulting" }, ...]
 */
export function useLookupOptions(listCode: string | undefined): UseLookupOptionsResult {
  const { getLookupValues } = useLookups();

  const options = useMemo((): LookupOptionItem[] => {
    if (!listCode) return [];
    return getLookupValues(listCode).map((v) => ({
      id: v.code,
      code: v.code,
      label: v.label ?? v.code,
      meta: v.meta as Record<string, unknown> | null,
      sort_order: v.sort_order,
    }));
  }, [listCode, getLookupValues]);

  return { options, isLoading: false };
}
