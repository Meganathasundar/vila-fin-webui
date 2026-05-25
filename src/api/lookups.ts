import { apiClient } from "./client";
import type {
  AllLookupsResponse,
  ListValuesResponse,
  LookupListCreate,
  LookupListDetail,
  LookupListUpdate,
  LookupListsResponse,
  LookupValue,
  LookupValueCreate,
  LookupValueUpdate,
} from "@/types/api";

/** Fetch ALL active lookup values grouped by list code (used for global cache bootstrap). */
export async function getAllLookups(): Promise<AllLookupsResponse> {
  const res = await apiClient.get<AllLookupsResponse>("/lookups");
  return res.data;
}

export async function listLookupLists(isActive?: boolean): Promise<LookupListsResponse> {
  const res = await apiClient.get<LookupListsResponse>("/lookups", {
    params: isActive !== undefined ? { is_active: isActive } : {},
  });
  return res.data;
}

/** GET /api/v1/lookups/{code} — returns { data: LookupValueSummary[], meta: {...} } */
export async function getLookupList(code: string): Promise<ListValuesResponse> {
  const res = await apiClient.get<ListValuesResponse>(`/lookups/${code}`);
  return res.data;
}

export async function createLookupList(data: LookupListCreate): Promise<LookupListDetail> {
  const res = await apiClient.post<LookupListDetail>("/lookups", data);
  return res.data;
}

export async function updateLookupList(code: string, data: LookupListUpdate): Promise<LookupListDetail> {
  const res = await apiClient.put<LookupListDetail>(`/lookups/${code}`, data);
  return res.data;
}

export async function createLookupValue(code: string, data: LookupValueCreate): Promise<LookupValue> {
  const res = await apiClient.post<LookupValue>(`/lookups/${code}/values`, data);
  return res.data;
}

/** PUT /api/v1/lookups/{code}/values/{valueCode}
 *  Path now uses the value's immutable code, not a UUID. */
export async function updateLookupValue(
  listCode: string,
  valueCode: string,
  data: LookupValueUpdate
): Promise<LookupValue> {
  const res = await apiClient.put<LookupValue>(`/lookups/${listCode}/values/${valueCode}`, data);
  return res.data;
}

/** Convenience: fetch active values for the "garage" lookup list */
export async function listGarages(): Promise<ListValuesResponse["data"]> {
  const res = await getLookupList("garage");
  return (res.data ?? []).filter((v) => v.is_active !== false);
}
