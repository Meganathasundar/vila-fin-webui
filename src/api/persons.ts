import { apiClient } from "./client";
import type { Person, PersonCreate, PersonUpdate, PersonList } from "@/types/api";

interface ListParams {
  limit?: number;
  offset?: number;
  full_name?: string;
  phone?: string;
  id_type?: string;
  id_number?: string;
  kyc_status?: string;
}

export async function listPersons(params: ListParams = {}): Promise<PersonList> {
  const res = await apiClient.get<PersonList>("/persons", { params });
  return res.data;
}

export async function getPerson(id: string): Promise<Person> {
  const res = await apiClient.get<Person>(`/persons/${id}`);
  return res.data;
}

export async function createPerson(data: PersonCreate): Promise<Person> {
  const res = await apiClient.post<Person>("/persons", data);
  return res.data;
}

export async function updatePerson(id: string, data: PersonUpdate): Promise<Person> {
  const res = await apiClient.put<Person>(`/persons/${id}`, data);
  return res.data;
}
