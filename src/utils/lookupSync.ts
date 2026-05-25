/**
 * Lookup sync bridge — decouples api/client.ts (interceptor layer) from
 * context/LookupContext.tsx (React layer) so neither has to import the other.
 *
 * client.ts calls triggerLookupRefresh() when it sees meta.lookup_stale = true.
 * LookupContext registers its refresh function via registerLookupRefresher().
 */

// ── Refresh callback ──────────────────────────────────────────────────────────

let _refreshFn: (() => void) | null = null;

export function registerLookupRefresher(fn: () => void): void {
  _refreshFn = fn;
}

export function triggerLookupRefresh(): void {
  _refreshFn?.();
}

// ── Persistent version storage ────────────────────────────────────────────────

const VERSION_KEY = "lookup_version";

export function getStoredLookupVersion(): number {
  try {
    return parseInt(localStorage.getItem(VERSION_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function setStoredLookupVersion(v: number): void {
  try {
    localStorage.setItem(VERSION_KEY, String(v));
  } catch {
    // localStorage unavailable (e.g. private browsing strict mode)
  }
}
