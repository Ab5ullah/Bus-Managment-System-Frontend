import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { UserRole } from "@busms/config/constants";
import { REFRESH_COOKIE_NAME } from "@busms/api-client/bff";
import middleware from "../middleware";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

function makeRequest(path: string, cookieToken?: string): NextRequest {
  const headers = new Headers();
  if (cookieToken) {
    headers.set("cookie", `${REFRESH_COOKIE_NAME}=${encodeURIComponent(cookieToken)}`);
  }
  return new NextRequest(`http://localhost:3001${path}`, { headers });
}

describe("apps/admin RBAC middleware", () => {
  const futureExp = Math.floor(Date.now() / 1000) + 3600;

  it("redirects unauthenticated user from /en/fleet to /en/login", () => {
    const res = middleware(makeRequest("/en/fleet"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/en/login");
    expect(res.headers.get("location")).toContain("next=%2Ffleet");
  });

  it("rejects PASSENGER role cookie with unauthorized error", () => {
    const token = makeJwt({ user_id: "u1", role: UserRole.PASSENGER, exp: futureExp });
    const res = middleware(makeRequest("/en/fleet", token));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=unauthorized");
  });

  it("redirects CONDUCTOR away from /en/reports to /en/gate-scanner", () => {
    const token = makeJwt({ user_id: "u2", role: UserRole.CONDUCTOR, exp: futureExp });
    const res = middleware(makeRequest("/en/reports", token));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3001/en/gate-scanner");
  });

  it("allows CONDUCTOR on /ur/gate-scanner", () => {
    const token = makeJwt({ user_id: "u2", role: UserRole.CONDUCTOR, exp: futureExp });
    const res = middleware(makeRequest("/ur/gate-scanner", token));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows OPERATOR on /en/fleet and redirects away from /en/login", () => {
    const token = makeJwt({ user_id: "u3", role: UserRole.OPERATOR, exp: futureExp });
    const fleetRes = middleware(makeRequest("/en/fleet", token));
    expect(fleetRes.headers.get("location")).toBeNull();

    const loginRes = middleware(makeRequest("/en/login", token));
    expect(loginRes.status).toBe(307);
    expect(loginRes.headers.get("location")).toBe("http://localhost:3001/en");
  });
});
