import { decodeJwtPayload } from "../auth/jwt";
import type { AuthUser, PassengerProfile } from "../types";
import type { UserRole } from "@busms/config/constants";

export const REFRESH_COOKIE_NAME = "busms_refresh";

export interface BffConfig {
  backendBaseUrl?: string;
  cookieSecure?: boolean;
  allowedRoles?: readonly UserRole[];
}

function getBackendBaseUrl(config?: BffConfig): string {
  return (
    config?.backendBaseUrl ||
    process.env.INTERNAL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

function shouldUseSecureCookie(config?: BffConfig): boolean {
  if (typeof config?.cookieSecure === "boolean") return config.cookieSecure;
  return process.env.AUTH_COOKIE_SECURE === "true";
}

function serializeCookie(
  name: string,
  value: string,
  options: { httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict"; path?: string; maxAge?: number }
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? "/"}`);
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite === "strict" ? "Strict" : "Lax"}`);
  return parts.join("; ");
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function jsonResponse(body: unknown, status = 200, setCookie?: string): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (setCookie) {
    headers.append("Set-Cookie", setCookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export async function handleBffLogin(request: Request, config?: BffConfig): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.identifier !== "string" || typeof body.password !== "string") {
    return jsonResponse(
      { success: false, error: { code: "INVALID_PAYLOAD", message: "Identifier and password are required." } },
      400
    );
  }

  const backendUrl = `${getBackendBaseUrl(config)}/api/auth/login/`;
  let upstream: Response;
  try {
    upstream = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: body.identifier, password: body.password }),
    });
  } catch {
    return jsonResponse(
      { success: false, error: { code: "BACKEND_UNREACHABLE", message: "Authentication service unavailable." } },
      502
    );
  }

  const upstreamJson = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !upstreamJson?.success) {
    return jsonResponse(
      upstreamJson && typeof upstreamJson === "object" && "error" in upstreamJson
        ? upstreamJson
        : {
            success: false,
            error: {
              code: "AUTH_FAILED",
              message: upstreamJson?.detail || upstreamJson?.message || "Invalid credentials.",
              details: upstreamJson,
            },
          },
      upstream.status || 401
    );
  }

  const user = upstreamJson.data?.user as AuthUser | undefined;
  const profile = (upstreamJson.data?.profile ?? null) as PassengerProfile | null;
  const tokens = upstreamJson.data?.tokens as { access?: string; refresh?: string } | undefined;

  if (!user || !tokens?.access || !tokens?.refresh) {
    return jsonResponse(
      { success: false, error: { code: "INVALID_UPSTREAM", message: "Unexpected login response format." } },
      502
    );
  }

  if (config?.allowedRoles && !config.allowedRoles.includes(user.role)) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "ROLE_FORBIDDEN",
          message: "Your account role does not have access to this portal.",
        },
      },
      403
    );
  }

  const cookie = serializeCookie(REFRESH_COOKIE_NAME, tokens.refresh, {
    httpOnly: true,
    secure: shouldUseSecureCookie(config),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return jsonResponse(
    {
      success: true,
      message: upstreamJson.message || "Authentication successful.",
      data: {
        accessToken: tokens.access,
        user,
        profile,
      },
    },
    200,
    cookie
  );
}

export async function handleBffRefresh(request: Request, config?: BffConfig): Promise<Response> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const refreshToken = cookies[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    return jsonResponse(
      { success: false, error: { code: "NO_REFRESH_TOKEN", message: "No active session." } },
      401
    );
  }

  const baseUrl = getBackendBaseUrl(config);
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
  } catch {
    return jsonResponse(
      { success: false, error: { code: "BACKEND_UNREACHABLE", message: "Authentication service unavailable." } },
      502
    );
  }

  const upstreamJson = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !upstreamJson?.data?.access) {
    const clearCookie = serializeCookie(REFRESH_COOKIE_NAME, "", {
      httpOnly: true,
      secure: shouldUseSecureCookie(config),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return jsonResponse(
      { success: false, error: { code: "REFRESH_FAILED", message: "Session expired." } },
      401,
      clearCookie
    );
  }

  const newAccess = upstreamJson.data.access as string;
  const rotatedRefresh = (upstreamJson.data.refresh as string | undefined) || refreshToken;
  const jwtPayload = decodeJwtPayload(newAccess);

  const role = (jwtPayload?.role as UserRole | undefined) || "PASSENGER";
  if (config?.allowedRoles && !config.allowedRoles.includes(role)) {
    const clearCookie = serializeCookie(REFRESH_COOKIE_NAME, "", {
      httpOnly: true,
      secure: shouldUseSecureCookie(config),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return jsonResponse(
      { success: false, error: { code: "ROLE_FORBIDDEN", message: "Role not permitted." } },
      403,
      clearCookie
    );
  }

  // Fetch user profile to hydrate user metadata seamlessly
  let profile: PassengerProfile | null = null;
  let user: AuthUser = {
    id: String(jwtPayload?.user_id || ""),
    phone: String(jwtPayload?.phone || ""),
    email: null,
    role,
    role_display: role,
    is_verified: true,
    created_at: new Date().toISOString(),
  };

  try {
    const profileRes = await fetch(`${baseUrl}/api/accounts/profile/`, {
      method: "GET",
      headers: { Authorization: `Bearer ${newAccess}` },
    });
    if (profileRes.ok) {
      const profileJson = await profileRes.json().catch(() => null);
      if (profileJson?.success && profileJson.data) {
        profile = profileJson.data as PassengerProfile;
        if (profile.user) {
          user = profile.user;
        }
      }
    }
  } catch {
    // Non-fatal: JWT claims already hydrate core user identity
  }

  const setCookie = serializeCookie(REFRESH_COOKIE_NAME, rotatedRefresh, {
    httpOnly: true,
    secure: shouldUseSecureCookie(config),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return jsonResponse(
    {
      success: true,
      message: "Token refreshed.",
      data: {
        accessToken: newAccess,
        user,
        profile,
      },
    },
    200,
    setCookie
  );
}

export async function handleBffLogout(request: Request, config?: BffConfig): Promise<Response> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const refreshToken = cookies[REFRESH_COOKIE_NAME];
  const authHeader = request.headers.get("authorization");

  if (refreshToken && authHeader) {
    await fetch(`${getBackendBaseUrl(config)}/api/auth/logout/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ refresh: refreshToken }),
    }).catch(() => undefined);
  }

  const clearCookie = serializeCookie(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: shouldUseSecureCookie(config),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return jsonResponse(
    {
      success: true,
      message: "Signed out successfully.",
      data: {},
    },
    200,
    clearCookie
  );
}
