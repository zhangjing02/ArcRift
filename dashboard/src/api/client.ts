import axios from "axios";

// v1.6.4: Configurable backend URL with automatic origin detection for Electron / Localhost
const BACKEND =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== "undefined" &&
  window.location.origin &&
  !window.location.origin.includes(":5173") &&
  !window.location.origin.includes(":5174") &&
  window.location.origin.startsWith("http")
    ? window.location.origin
    : "http://localhost:3001");

export const apiClient = axios.create({
  baseURL: BACKEND,
  timeout: 120000, // 120s timeout for large payloads
  headers: {
    "Content-Type": "application/json"
  }
});

// Helper to extract clean error messages
export function extractErrorMessage(err: any): string {
  if (axios.isAxiosError(err)) {
    return (
      err.response?.data?.error ||
      err.response?.data?.message ||
      (err.code === "ECONNABORTED" ? "请求超时，请分批重试" : err.message) ||
      "网络请求失败"
    );
  }
  return err instanceof Error ? err.message : String(err);
}

