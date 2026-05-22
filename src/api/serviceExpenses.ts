import { apiClient } from "./client";

export interface ServiceExpense {
  id?: string;
  vehicle_id?: string;
  service_type?: string;
  description?: string;
  cost?: string;
  service_date?: string;
  garage_name?: string;
  odometer_reading?: number;
  created_by?: string;
  created_at?: string;
}

export interface ServiceExpenseCreate {
  vehicle_id: string;
  service_type: string;
  description?: string;
  cost: string;
  service_date: string;
  garage_name?: string;
  odometer_reading?: number;
}

interface ServiceExpenseList {
  data?: ServiceExpense[];
  meta?: { limit?: number; offset?: number; total?: number };
}

export async function listServiceExpenses(params: Record<string, string | number | undefined> = {}): Promise<ServiceExpenseList> {
  const res = await apiClient.get<ServiceExpenseList>("/service-expenses", { params });
  return res.data;
}

export async function createServiceExpense(data: ServiceExpenseCreate): Promise<ServiceExpense> {
  const res = await apiClient.post<ServiceExpense>("/service-expenses", data);
  return res.data;
}
