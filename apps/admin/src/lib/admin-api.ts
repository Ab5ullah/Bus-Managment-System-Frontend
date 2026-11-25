import { ApiException, getDefaultApiBaseUrl } from "@busms/api-client";

export async function adminFetch<T>(
  path: string,
  getToken: () => Promise<string | null>,
  init: RequestInit = {}
): Promise<T> {
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");
  const token = await getToken();

  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 204) {
    return {} as T;
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || (json && typeof json === "object" && "success" in json && json.success === false)) {
    const err = json?.error ?? {};
    let message = err.message || json?.detail || `Request failed (${res.status}).`;
    if (err.details && typeof err.details === "object") {
      const firstDetail = Object.values(err.details).flat()[0];
      if (typeof firstDetail === "string" && !message.includes(firstDetail)) {
        message = `${message} ${firstDetail}`;
      }
    }
    throw new ApiException(message, res.status, err.code || "API_ERROR", err.details || {});
  }

  if (json && typeof json === "object" && "data" in json) {
    return json.data as T;
  }
  return json as T;
}

export function formatShortDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function toDateTimeLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
