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

export async function formPost<T>(url: string, data: FormData): Promise<T> {
  const res = await api.post<T>(url, data, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data;
}
