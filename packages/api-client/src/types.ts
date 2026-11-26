import type { UserRole, Gender } from "@busms/config/constants";

export interface ApiSuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorPayload;
}

export class ApiException extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(
    message: string,
    status = 400,
    code = "API_ERROR",
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiException";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface AuthUser {
  id: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  role_display: string;
  is_verified: boolean;
  created_at: string;
}

export interface PassengerProfile {
  id: string;
  user: AuthUser;
  full_name: string;
  gender: Gender;
  dob?: string | null;
  cnic_id_number?: string | null;
  emergency_contact?: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
  profile?: PassengerProfile | null;
}

export interface PaginatedData<T> {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function normalizePaginated<T>(
  payload: PaginatedData<T> | T[] | null | undefined,
  pageSize = 20
): PaginatedData<T> {
  if (!payload) {
    return {
      count: 0,
      total_pages: 1,
      current_page: 1,
      page_size: pageSize,
      next: null,
      previous: null,
      results: [],
    };
  }
  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      total_pages: 1,
      current_page: 1,
      page_size: payload.length || pageSize,
      next: null,
      previous: null,
      results: payload,
    };
  }
  return payload;
}

const GENERIC_VALIDATION_MESSAGES = new Set([
  "validation failed for one or more fields.",
  "validation failed.",
  "bad request.",
  "request failed.",
  "invalid input.",
]);

function flattenErrorValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = flattenErrorValue(item);
      if (nested) return nested;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const nestedVal of Object.values(value as Record<string, unknown>)) {
      const nested = flattenErrorValue(nestedVal);
      if (nested) return nested;
    }
  }
  return null;
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Extracts flattened field-level error strings from DRF `error.details`.
 */
export function extractApiFieldErrors(details: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return result;
  }
  for (const [field, rawVal] of Object.entries(details as Record<string, unknown>)) {
    const msg = flattenErrorValue(rawVal);
    if (msg) {
      result[field] = msg;
    }
  }
  return result;
}

/**
 * Resolves the most specific user-facing error message from a BUSMS API error envelope,
 * prioritizing `error.details` whenever `error.message` is a generic validation summary.
 */
export function extractApiErrorMessage(payload: unknown, fallback = "Request failed."): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const obj = payload as Record<string, unknown>;
  const errObj =
    obj.error && typeof obj.error === "object"
      ? (obj.error as Record<string, unknown>)
      : obj;

  const baseMessage =
    (typeof errObj.message === "string" && errObj.message.trim()) ||
    (typeof obj.detail === "string" && obj.detail.trim()) ||
    "";

  const fieldErrors = extractApiFieldErrors(errObj.details);
  const entries = Object.entries(fieldErrors);

  if (entries.length > 0) {
    const formatted = entries.map(([field, msg]) => {
      if (field === "non_field_errors" || field === "detail" || field === "details") {
        return msg;
      }
      const readableField = field.replace(/_/g, " ").toLowerCase();
      if (msg.toLowerCase().includes(readableField) || msg.toLowerCase().includes(field.toLowerCase())) {
        return msg;
      }
      return `${formatFieldLabel(field)}: ${msg}`;
    });

    if (!baseMessage || GENERIC_VALIDATION_MESSAGES.has(baseMessage.toLowerCase())) {
      return formatted.join(" ");
    }
    return `${baseMessage} (${formatted[0]})`;
  }

  return baseMessage || fallback;
}


