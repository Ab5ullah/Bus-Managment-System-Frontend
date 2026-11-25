import { describe, expect, it } from "vitest";
import { Gender } from "../constants";
import { checkoutFormSchema, savedPassengerSchema, cnicOrPassportRegex } from "../schemas";

describe("checkoutFormSchema & gender/CNIC validation", () => {
  const seatUuid = "11111111-1111-4111-8111-111111111111";

  it("validates Pakistani CNIC and passport formats", () => {
    expect(cnicOrPassportRegex.test("35202-1234567-1")).toBe(true);
    expect(cnicOrPassportRegex.test("3520212345671")).toBe(true);
    expect(cnicOrPassportRegex.test("AB1234567")).toBe(true);
    expect(cnicOrPassportRegex.test("123")).toBe(false);
  });

  it("rejects non-female passenger on a ladies-only or female-adjacent-restricted seat", () => {
    const result = checkoutFormSchema.safeParse({
      passenger_name: "Ali Raza",
      passenger_phone: "+923001234567",
      passenger_email: "",
      coupon_code: "",
      passengers: [
        {
          seat_id: seatUuid,
          seat_number: "1B",
          is_ladies_only: true,
          passenger_name: "Ali Raza",
          gender: Gender.MALE,
          age: "28",
          cnic_or_id: "35202-1234567-1",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Ladies-Only");
    }
  });

  it("accepts female passenger on a ladies-only seat", () => {
    const result = checkoutFormSchema.safeParse({
      passenger_name: "Amina Khan",
      passenger_phone: "+923001234567",
      passenger_email: "amina@example.com",
      coupon_code: "",
      passengers: [
        {
          seat_id: seatUuid,
          seat_number: "1B",
          is_ladies_only: true,
          passenger_name: "Amina Khan",
          gender: Gender.FEMALE,
          age: "26",
          cnic_or_id: "35202-1234567-2",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("validates savedPassengerSchema", () => {
    const ok = savedPassengerSchema.safeParse({
      full_name: "Zainab Tariq",
      gender: Gender.FEMALE,
      age: 31,
      cnic_id_number: "42101-7654321-2",
    });
    expect(ok.success).toBe(true);
  });
});
