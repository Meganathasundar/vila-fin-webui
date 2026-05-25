import { apiClient } from "./client";
import type { ServiceExpense, ServiceExpenseCreate, ServiceExpenseList } from "@/types/api";

interface ListParams {
  vehicle_id?: string;
  service_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export async function listServiceExpenses(params: ListParams = {}): Promise<ServiceExpenseList> {
  const res = await apiClient.get<ServiceExpenseList>("/service-expenses", { params });
  return res.data;
}

export async function getServiceExpense(id: string): Promise<ServiceExpense> {
  const res = await apiClient.get<ServiceExpense>(`/service-expenses/${id}`);
  return res.data;
}

export async function createServiceExpense(data: ServiceExpenseCreate): Promise<ServiceExpense> {
  const res = await apiClient.post<ServiceExpense>("/service-expenses", data);
  return res.data;
}
