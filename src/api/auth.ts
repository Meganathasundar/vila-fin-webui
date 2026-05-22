import { apiClient } from "./client";
import type { LoginRequest, TokenResponse, Profile } from "@/types/api";

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>("/auth/login", data);
  return res.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function refreshToken(): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>("/auth/refresh");
  return res.data;
}

export async function getMe(): Promise<Profile> {
  const res = await apiClient.get<Profile>("/auth/me");
  return res.data;
}
