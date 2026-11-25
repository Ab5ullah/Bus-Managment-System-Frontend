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

