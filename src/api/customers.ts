import { apiClient } from "./client";
import type { Customer, CustomerCreate, CustomerUpdate, CustomerList } from "@/types/api";

interface ListParams {
  limit?: number;
  offset?: number;
  phone?: string;
  kyc_status?: string;
}

export async function listCustomers(params: ListParams = {}): Promise<CustomerList> {
  const res = await apiClient.get<CustomerList>("/customers", { params });
  return res.data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const res = await apiClient.get<Customer>(`/customers/${id}`);
  return res.data;
}

export async function createCustomer(data: CustomerCreate): Promise<Customer> {
  const res = await apiClient.post<Customer>("/customers", data);
  return res.data;
}

export async function updateCustomer(id: string, data: CustomerUpdate): Promise<Customer> {
  const res = await apiClient.put<Customer>(`/customers/${id}`, data);
  return res.data;
}
