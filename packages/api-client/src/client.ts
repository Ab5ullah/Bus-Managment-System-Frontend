import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/schema";
import { ApiException, type ApiErrorEnvelope, type ApiSuccessEnvelope } from "./types";

export interface CreateApiClientOptions {
  baseUrl?: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  onUnauthorized?: () => Promise<string | null>;
}

export function getDefaultApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
  }
  return (
    process.env.INTERNAL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  );
}

export function createBusmsApiClient(options: CreateApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? getDefaultApiBaseUrl()).replace(/\/$/, "");
  const client = createClient<paths>({ baseUrl });

  const authMiddleware: Middleware = {
    async onRequest({ request }) {
      if (options.getAccessToken) {
        const token = await options.getAccessToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      }
      return request;
    },
    async onResponse({ request, response }) {
      if (response.status === 401 && options.onUnauthorized) {
        const freshToken = await options.onUnauthorized();
        if (freshToken) {
          const retryRequest = request.clone();
          retryRequest.headers.set("Authorization", `Bearer ${freshToken}`);
          return fetch(retryRequest);
        }
      }
      return response;
    },
  };

  client.use(authMiddleware);
  return client;
}

export function unwrapEnvelope<T>(result: {
  data?: unknown;
  error?: unknown;
  response: Response;
}): T {
  if (result.error) {
    const err = result.error as Partial<ApiErrorEnvelope> & { detail?: string; message?: string };
    const payload = err?.error;
    throw new ApiException(
      payload?.message || err?.detail || err?.message || "Request failed.",
      result.response.status,
      payload?.code || "API_ERROR",
      payload?.details || {}
    );
  }

  const body = result.data as ApiSuccessEnvelope<T> | ApiErrorEnvelope | T | undefined;
  if (body && typeof body === "object" && "success" in body) {
    if (body.success === false) {
      throw new ApiException(
        body.error?.message || "Request failed.",
        result.response.status,
        body.error?.code || "API_ERROR",
        body.error?.details || {}
      );
    }
    if ("data" in body) {
      return body.data as T;
    }
  }

  return body as T;
}
