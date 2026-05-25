import { apiClient } from "./client";
import type { CostIncurred, CostIncurredCreate, CostIncurredUpdate, CostIncurredList } from "@/types/api";

interface ListParams {
  vehicle_id?: string;
  cost_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export async function listCostsIncurred(params: ListParams = {}): Promise<CostIncurredList> {
  const res = await apiClient.get<CostIncurredList>("/costs-incurred", { params });
  return res.data;
}

export async function getCostIncurred(id: string): Promise<CostIncurred> {
  const res = await apiClient.get<CostIncurred>(`/costs-incurred/${id}`);
  return res.data;
}

export async function createCostIncurred(data: CostIncurredCreate): Promise<CostIncurred> {
  const res = await apiClient.post<CostIncurred>("/costs-incurred", data);
  return res.data;
}

export async function updateCostIncurred(id: string, data: CostIncurredUpdate): Promise<CostIncurred> {
  const res = await apiClient.put<CostIncurred>(`/costs-incurred/${id}`, data);
  return res.data;
}
