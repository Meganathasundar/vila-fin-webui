/**
 * LookupContext — global lookup data store.
 *
 * Bootstrap sequence:
 *  1. Read lookup_data + lookup_version from localStorage.
 *  2. If cached data exists → set isReady immediately (cache hit, no loading screen).
 *  3. Always call GET /api/v1/lookups to check for fresh data.
 *  4. On success → update state + localStorage.
 *  5. On failure → silently keep cached data (or empty if nothing cached).
 *  6. isReady is set to true in every path (finally block).
 *
 * Background refresh:
 *  When client.ts sees meta.lookup_stale = true in any API response it calls
 *  triggerLookupRefresh() via lookupSync. That calls the refreshLookups function
 *  registered here, which silently re-fetches and updates state.
 *
 * Per-list cache (for x-field-type: lookup fields):
 *  useLookupOptions(listCode) reads from localStorage key "lookup_values_<code>".
 *  Each entry stores { version, values[] } — values include the UUID needed for
 *  form submission. When lookupVersion increments, hooks with that queryKey
 *  re-run, detect the version mismatch, and re-fetch from the API.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { getAllLookups } from "@/api/lookups";
import {
  registerLookupRefresher,
  getStoredLookupVersion,
  setStoredLookupVersion,
} from "@/utils/lookupSync";
import { Skeleton } from "@/components/ui/skeleton";
import type { LookupValueSummary } from "@/types/api";

// ── Storage helpers ───────────────────────────────────────────────────────────

const DATA_KEY = "lookup_data";

type LookupStore = Record<string, LookupValueSummary[]>;

function readStoredData(): LookupStore | null {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? (JSON.parse(raw) as LookupStore) : null;
  } catch {
    return null;
  }
}

function writeStoredData(data: LookupStore): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded or unavailable — silently skip
  }
}

// ── Context types ─────────────────────────────────────────────────────────────

interface LookupContextValue {
  /**
   * Resolve a lookup code to its display label.
   * Falls back to the code itself if not found — never returns empty/undefined.
   */
  getLookupLabel: (listName: string, code: string) => string;

  /**
   * Return all active values for a list, sorted by sort_order.
   * Returns empty array if the list is not found.
   */
  getLookupValues: (listName: string) => LookupValueSummary[];

  /**
   * Current lookup data version (integer). Increments whenever a background
   * refresh pulls in new data. Components that depend on per-list option lists
   * (useLookupOptions) subscribe to this to know when to re-check their cache.
   */
  lookupVersion: number;
}

const LookupContext = createContext<LookupContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function LookupProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LookupStore>(() => readStoredData() ?? {});
  const [isReady, setIsReady] = useState<boolean>(() => readStoredData() !== null);
  // lookupVersion drives re-fetches in useLookupOptions — must be React state
  const [lookupVersion, setLookupVersion] = useState<number>(
    () => getStoredLookupVersion()
  );
  const isRefreshing = useRef(false);

  const applyFreshData = useCallback((fresh: LookupStore, version: number) => {
    setData(fresh);
    setLookupVersion(version);
    writeStoredData(fresh);
    setStoredLookupVersion(version);
  }, []);

  /** Fire-and-forget background refresh — called by lookupSync on lookup_stale. */
  const refreshLookups = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;
    try {
      const res = await getAllLookups();
      const fresh = res.data?.lookups ?? {};
      const version = res.meta?.lookup_version ?? getStoredLookupVersion();
      applyFreshData(fresh, version);
    } catch {
      // Silently ignore — keep existing data
    } finally {
      isRefreshing.current = false;
    }
  }, [applyFreshData]);

  // Register refresh callback so client.ts can trigger it
  useEffect(() => {
    registerLookupRefresher(refreshLookups);
  }, [refreshLookups]);

  // Bootstrap on mount
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const res = await getAllLookups();
        if (!cancelled) {
          const fresh = res.data?.lookups ?? {};
          const version = res.meta?.lookup_version ?? 0;
          applyFreshData(fresh, version);
        }
      } catch {
        // Failed to fetch — use whatever is in state (cached or empty)
      } finally {
        if (!cancelled) setIsReady(true);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [applyFreshData]);

  // ── Utility functions ────────────────────────────────────────────────────────

  const getLookupLabel = useCallback(
    (listName: string, code: string): string => {
      const list = data[listName];
      if (!list) return code;
      const entry = list.find((v) => v.code === code);
      return entry?.label ?? code;
    },
    [data]
  );

  const getLookupValues = useCallback(
    (listName: string): LookupValueSummary[] => {
      const list = data[listName];
      if (!list) return [];
      return [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    },
    [data]
  );

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  return (
    <LookupContext.Provider value={{ getLookupLabel, getLookupValues, lookupVersion }}>
      {children}
    </LookupContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLookups(): LookupContextValue {
  const ctx = useContext(LookupContext);
  if (!ctx) throw new Error("useLookups must be used within LookupProvider");
  return ctx;
}
