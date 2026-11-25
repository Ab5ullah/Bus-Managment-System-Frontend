import { describe, expect, it } from "vitest";
import { canRoleAccessAdminPath, UserRole } from "@busms/config/constants";
import { formatShortDateTime, toDateTimeLocalInput } from "../lib/admin-api";

describe("admin RBAC & formatting helpers", () => {
  it("enforces role permissions across Phase F6-F9 admin routes", () => {
    expect(canRoleAccessAdminPath(UserRole.COUNTER_AGENT, "/counter-pos")).toBe(true);
    expect(canRoleAccessAdminPath(UserRole.COUNTER_AGENT, "/promotions")).toBe(false);

    expect(canRoleAccessAdminPath(UserRole.CONDUCTOR, "/gate-scanner")).toBe(true);
    expect(canRoleAccessAdminPath(UserRole.CONDUCTOR, "/reports")).toBe(false);

    expect(canRoleAccessAdminPath(UserRole.OPERATOR, "/reports")).toBe(true);
    expect(canRoleAccessAdminPath(UserRole.OPERATOR, "/promotions")).toBe(true);
    expect(canRoleAccessAdminPath(UserRole.OPERATOR, "/cancellations")).toBe(true);

    expect(canRoleAccessAdminPath(UserRole.PASSENGER, "/counter-pos")).toBe(false);
  });

  it("formats ISO timestamps safely", () => {
    expect(formatShortDateTime(null)).toBe("—");
    expect(formatShortDateTime("not-a-date")).toBe("not-a-date");
    expect(toDateTimeLocalInput("")).toBe("");
    expect(toDateTimeLocalInput("2026-11-25T10:30:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
