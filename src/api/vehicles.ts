import { apiClient } from "./client";
import type { Vehicle, VehicleCreate, VehicleUpdate, VehicleList } from "@/types/api";

interface ListParams {
  limit?: number;
  offset?: number;
  registration_no?: string;
  current_status?: string;
  vehicle_source?: string;
}

export async function listVehicles(params: ListParams = {}): Promise<VehicleList> {
  const res = await apiClient.get<VehicleList>("/vehicles", { params });
  return res.data;
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const res = await apiClient.get<Vehicle>(`/vehicles/${id}`);
  return res.data;
}

export async function createVehicle(data: VehicleCreate): Promise<Vehicle> {
  const res = await apiClient.post<Vehicle>("/vehicles", data);
  return res.data;
}

export async function updateVehicle(id: string, data: VehicleUpdate): Promise<Vehicle> {
  const res = await apiClient.put<Vehicle>(`/vehicles/${id}`, data);
  return res.data;
}
