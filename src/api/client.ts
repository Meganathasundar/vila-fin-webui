import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";
import {
  getStoredLookupVersion,
  setStoredLookupVersion,
  triggerLookupRefresh,
} from "@/utils/lookupSync";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// ── In-memory access token ─────────────────────────────────────────────────
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ── Refresh token (sessionStorage — persists across page reloads in same tab) ──
const REFRESH_KEY = "vf_rt";

export function setRefreshToken(token: string | null) {
  if (token) sessionStorage.setItem(REFRESH_KEY, token);
  else sessionStorage.removeItem(REFRESH_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

// ── Refresh queue ──────────────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function processQueue(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

// Auth endpoints that should NOT trigger the 401→refresh interceptor
const AUTH_PATHS = ["/auth/login", "/auth/signup", "/auth/refresh"];
function isAuthEndpoint(url: string | undefined): boolean {
  return AUTH_PATHS.some((p) => url?.includes(p));
}

// ── Request interceptor: attach access token + lookup version header ───────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  // Send our cached lookup version so the server can detect staleness
  config.headers["X-Lookup-Version"] = String(getStoredLookupVersion());
  return config;
});

// ── Lookup stale check helper ──────────────────────────────────────────────
interface ResponseWithMeta {
  meta?: {
    lookup_version?: number;
    lookup_stale?: boolean;
  };
}

function handleLookupMeta(data: unknown): void {
  const meta = (data as ResponseWithMeta)?.meta;
  if (!meta) return;

  // Keep our stored version current with the server's version
  if (typeof meta.lookup_version === "number") {
    const stored = getStoredLookupVersion();
    if (meta.lookup_version > stored) {
      setStoredLookupVersion(meta.lookup_version);
    }
  }

  // If server says our data is stale, trigger a background refresh
  if (meta.lookup_stale === true) {
    triggerLookupRefresh();
  }
}

// ── Response interceptor: silent refresh on 401 + lookup stale handling ───
apiClient.interceptors.response.use(
  (res) => {
    // Check every successful response for lookup staleness
    handleLookupMeta(res.data);
    return res;
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Don't intercept 401s from auth endpoints — let them propagate to callers
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !isAuthEndpoint(original.url)
    ) {
      const rt = getRefreshToken();
      if (!rt) {
        // No refresh token — send to login
        setAccessToken(null);
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (token) {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(original));
            } else {
              reject(error);
            }
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          { refresh_token: rt },
          { withCredentials: true }
        );
        const newToken = data.access_token as string;
        const newRt = data.refresh_token as string | undefined;
        setAccessToken(newToken);
        if (newRt) setRefreshToken(newRt);
        processQueue(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        setAccessToken(null);
        setRefreshToken(null);
        processQueue(null);
        window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    const status = error.response?.status;
    if (status === 403) {
      toast.error("You don't have permission to perform this action");
    } else if (status === 500) {
      toast.error("Something went wrong. Please try again.");
    } else if (!error.response) {
      toast.error("Cannot reach the server. Check your connection.");
    }

    return Promise.reject(error);
  }
);
