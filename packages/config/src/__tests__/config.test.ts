import { describe, expect, it } from "vitest";
import {
  UserRole,
  canRoleAccessAdminPath,
  getDefaultRouteForRole,
  isRtlLocale,
} from "../constants";
import { checkoutFormSchema, loginSchema, registerSchema, verifyOtpSchema } from "../schemas";

describe("@busms/config constants & RBAC", () => {
  it("detects RTL locales accurately", () => {
    expect(isRtlLocale("ur")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
  });

  it("blocks PASSENGER from all admin routes", () => {
    expect(canRoleAccessAdminPath(UserRole.PASSENGER, "/en")).toBe(false);
    expect(canRoleAccessAdminPath(UserRole.PASSENGER, "/en/fleet")).toBe(false);
    expect(canRoleAccessAdminPath(UserRole.PASSENGER, "/ur/counter-pos")).toBe(false);
  });

  it("restricts COUNTER_AGENT to POS and cancellations", () => {
    expect(canRoleAccessAdminPath(UserRole.COUNTER_AGENT, "/en/counter-pos")).toBe(true);
    expect(canRoleAccessAdminPath(UserRole.COUNTER_AGENT, "/ur/cancellations")).toBe(true);
    expect(canRoleAccessAdminPath(UserRole.COUNTER_AGENT, "/en/fleet")).toBe(false);
    expect(canRoleAccessAdminPath(UserRole.COUNTER_AGENT, "/en")).toBe(false);
    expect(getDefaultRouteForRole(UserRole.COUNTER_AGENT)).toBe("/counter-pos");
  });

  it("restricts CONDUCTOR to gate scanner", () => {
    expect(canRoleAccessAdminPath(UserRole.CONDUCTOR, "/en/gate-scanner")).toBe(true);
    expect(canRoleAccessAdminPath(UserRole.CONDUCTOR, "/en/reports")).toBe(false);
    expect(getDefaultRouteForRole(UserRole.CONDUCTOR)).toBe("/gate-scanner");
  });

  it("allows OPERATOR and SUPER_ADMIN across operations modules", () => {
    for (const role of [UserRole.OPERATOR, UserRole.SUPER_ADMIN]) {
      expect(canRoleAccessAdminPath(role, "/en")).toBe(true);
      expect(canRoleAccessAdminPath(role, "/ur/fleet")).toBe(true);
      expect(canRoleAccessAdminPath(role, "/en/promotions")).toBe(true);
      expect(canRoleAccessAdminPath(role, "/en/reports")).toBe(true);
    }
  });
});

describe("@busms/config Zod schemas", () => {
  it("validates login and register schemas", () => {
    expect(loginSchema.safeParse({ identifier: "+923001234567", password: "secret" }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: "a", password: "" }).success).toBe(false);

    expect(
      registerSchema.safeParse({
        full_name: "Ali Khan",
        phone: "+923001234567",
        email: "ali@example.com",
        gender: "MALE",
        password: "Password123!",
      }).success
    ).toBe(true);

    expect(
      verifyOtpSchema.safeParse({
        identifier: "+923001234567",
        otp_code: "123456",
      }).success
    ).toBe(true);

    const ladiesOnlyInvalid = checkoutFormSchema.safeParse({
      passenger_name: "Bilal",
      passenger_phone: "+923001234567",
      passengers: [
        {
          seat_id: "11111111-1111-4111-8111-111111111111",
          seat_number: "2A",
          is_ladies_only: true,
          passenger_name: "Bilal",
          gender: "MALE",
          cnic_or_id: "35202-1234567-1",
        },
      ],
    });
    expect(ladiesOnlyInvalid.success).toBe(false);

    const ladiesOnlyValid = checkoutFormSchema.safeParse({
      passenger_name: "Ayesha",
      passenger_phone: "+923001234567",
      passengers: [
        {
          seat_id: "11111111-1111-4111-8111-111111111111",
          seat_number: "2A",
          is_ladies_only: true,
          passenger_name: "Ayesha",
          gender: "FEMALE",
          cnic_or_id: "35202-1234567-1",
        },
      ],
    });
    expect(ladiesOnlyValid.success).toBe(true);

    const missingCnic = checkoutFormSchema.safeParse({
      passenger_name: "Ayesha",
      passenger_phone: "+923001234567",
      passengers: [
        {
          seat_id: "11111111-1111-4111-8111-111111111111",
          seat_number: "2A",
          is_ladies_only: true,
          passenger_name: "Ayesha",
          gender: "FEMALE",
          cnic_or_id: "",
        },
      ],
    });
    expect(missingCnic.success).toBe(false);
  });
});
