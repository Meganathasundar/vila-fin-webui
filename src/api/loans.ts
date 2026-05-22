import { apiClient } from "./client";
import type { Loan, LoanCreate, LoanUpdate, LoanList } from "@/types/api";

interface ListParams {
  limit?: number;
  offset?: number;
  status?: string;
  loan_type?: string;
  loan_number?: string;
}

export async function listLoans(params: ListParams = {}): Promise<LoanList> {
  const res = await apiClient.get<LoanList>("/loans", { params });
  return res.data;
}

export async function getLoan(id: string): Promise<Loan> {
  const res = await apiClient.get<Loan>(`/loans/${id}`);
  return res.data;
}

export async function createLoan(data: LoanCreate): Promise<Loan> {
  const res = await apiClient.post<Loan>("/loans", data);
  return res.data;
}

export async function updateLoan(id: string, data: LoanUpdate): Promise<Loan> {
  const res = await apiClient.put<Loan>(`/loans/${id}`, data);
  return res.data;
}

export async function activateLoan(id: string, loan: Loan): Promise<Loan> {
  return updateLoan(id, { ...loan, status: "active" } as LoanUpdate);
}

export async function closeLoan(id: string, loan: Loan): Promise<Loan> {
  return updateLoan(id, { ...loan, status: "closed" } as LoanUpdate);
}

export async function defaultLoan(id: string, loan: Loan): Promise<Loan> {
  return updateLoan(id, { ...loan, status: "defaulted" } as LoanUpdate);
}

export async function cancelLoan(id: string, loan: Loan): Promise<Loan> {
  return updateLoan(id, { ...loan, status: "cancelled" } as LoanUpdate);
}
