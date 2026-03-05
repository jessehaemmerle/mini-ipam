import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true
});

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await api.get<T>(url, { params });
  return res.data;
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const res = await api.post<T>(url, data);
  return res.data;
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  const res = await api.put<T>(url, data);
  return res.data;
}

export async function del<T>(url: string): Promise<T> {
  const res = await api.delete<T>(url);
  return res.data;
}

export async function formPost<T>(url: string, data: FormData): Promise<T> {
  const res = await api.post<T>(url, data, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data;
}

export function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (error.response?.status === 401) return "Nicht eingeloggt. Bitte unter Admin anmelden.";
    if (error.response?.status === 403) return "Keine Berechtigung zum Speichern.";
    return `API Fehler (${error.response?.status ?? "unbekannt"})`;
  }
  if (error instanceof Error) return error.message;
  return "Unbekannter Fehler";
}

