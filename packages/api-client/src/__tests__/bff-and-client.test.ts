import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_PORTAL_ROLES, UserRole } from "@busms/config/constants";
import { decodeJwtPayload, extractRoleFromJwt, isJwtExpired } from "../auth/jwt";
import { handleBffLogin, handleBffLogout, handleBffRefresh, REFRESH_COOKIE_NAME } from "../bff/handlers";
import { ApiException, unwrapEnvelope } from "../index";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("JWT utilities", () => {
  it("decodes role and checks expiry", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeFakeJwt({ user_id: "u1", role: "OPERATOR", exp: futureExp });
    expect(decodeJwtPayload(token)?.user_id).toBe("u1");
    expect(extractRoleFromJwt(token)).toBe("OPERATOR");
    expect(isJwtExpired(token)).toBe(false);

    const expiredToken = makeFakeJwt({ user_id: "u1", exp: Math.floor(Date.now() / 1000) - 60 });
    expect(isJwtExpired(expiredToken)).toBe(true);
  });
});

describe("BFF Auth Handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets httpOnly refresh cookie on login and omits refresh from JSON body", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const access = makeFakeJwt({ user_id: "u1", role: UserRole.OPERATOR, exp: futureExp });
    const refresh = makeFakeJwt({ user_id: "u1", role: UserRole.OPERATOR, exp: futureExp + 86400 });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            message: "Authentication successful.",
            data: {
              user: {
                id: "u1",
                phone: "+923001112223",
                email: "ops@safarline.pk",
                role: UserRole.OPERATOR,
                role_display: "Operator / Admin",
                is_verified: true,
                created_at: "2026-01-01T00:00:00Z",
              },
              profile: null,
              tokens: { access, refresh },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const req = new Request("http://localhost:3001/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "+923001112223", password: "Password123!" }),
    });

    const res = await handleBffLogin(req, {
      backendBaseUrl: "http://127.0.0.1:8000",
      allowedRoles: ADMIN_PORTAL_ROLES,
    });

    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") || "";
    expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBe(access);
    expect(body.data.tokens).toBeUndefined();
  });

  it("rejects PASSENGER on admin BFF login with 403 and no cookie", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const access = makeFakeJwt({ user_id: "u2", role: UserRole.PASSENGER, exp: futureExp });
    const refresh = makeFakeJwt({ user_id: "u2", role: UserRole.PASSENGER, exp: futureExp + 86400 });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              user: { id: "u2", phone: "+923009998887", role: UserRole.PASSENGER },
              tokens: { access, refresh },
            },
          }),
          { status: 200 }
        )
      )
    );

    const req = new Request("http://localhost:3001/api/session/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "+923009998887", password: "Password123!" }),
    });

    const res = await handleBffLogin(req, {
      backendBaseUrl: "http://127.0.0.1:8000",
      allowedRoles: ADMIN_PORTAL_ROLES,
    });

    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("rotates refresh cookie on /refresh and clears it on /logout", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const newAccess = makeFakeJwt({ user_id: "u1", role: UserRole.OPERATOR, exp: futureExp });
    const newRefresh = makeFakeJwt({ user_id: "u1", role: UserRole.OPERATOR, exp: futureExp + 86400 });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { access: newAccess, refresh: newRefresh } }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { id: "p1", full_name: "Ops Lead", gender: "MALE", user: { id: "u1", phone: "+92300", role: UserRole.OPERATOR } },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const refreshReq = new Request("http://localhost:3001/api/session/refresh", {
      method: "POST",
      headers: { cookie: `${REFRESH_COOKIE_NAME}=old_refresh_token` },
    });
    const refreshRes = await handleBffRefresh(refreshReq, {
      backendBaseUrl: "http://127.0.0.1:8000",
      allowedRoles: ADMIN_PORTAL_ROLES,
    });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.headers.get("set-cookie")).toContain(encodeURIComponent(newRefresh));

    const logoutReq = new Request("http://localhost:3001/api/session/logout", {
      method: "POST",
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=${newRefresh}`,
        authorization: `Bearer ${newAccess}`,
      },
    });
    const logoutRes = await handleBffLogout(logoutReq, { backendBaseUrl: "http://127.0.0.1:8000" });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("unwrapEnvelope", () => {
  it("unwraps success envelopes and throws ApiException on errors", () => {
    const ok = unwrapEnvelope<{ count: number }>({
      data: { success: true, message: "ok", data: { count: 3 } },
      response: new Response(null, { status: 200 }),
    });
    expect(ok.count).toBe(3);

    expect(() =>
      unwrapEnvelope({
        error: { success: false, error: { code: "LOCKED", message: "Account locked" } },
        response: new Response(null, { status: 403 }),
      })
    ).toThrowError(ApiException);
  });
});
