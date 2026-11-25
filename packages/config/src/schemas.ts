import { z } from "zod";
import { Gender, UserRole } from "./constants";

export const phoneRegex = /^[+]?[\d\s-]{10,20}$/;

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your phone number or email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(150),
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number with country/area code"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]).default(Gender.MALE),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum([UserRole.PASSENGER, UserRole.COUNTER_AGENT]).default(UserRole.PASSENGER),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const verifyOtpSchema = z.object({
  identifier: z.string().trim().min(3, "Phone or email is required"),
  otp_code: z.string().trim().length(6, "OTP must be 6 digits"),
  purpose: z.enum(["REGISTRATION", "LOGIN", "PASSWORD_RESET"]).default("REGISTRATION"),
});
export type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export const passwordResetRequestSchema = z.object({
  identifier: z.string().trim().min(3, "Phone or email is required"),
});
export type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
  identifier: z.string().trim().min(3, "Phone or email is required"),
  otp_code: z.string().trim().length(6, "OTP must be 6 digits"),
  new_password: z.string().min(8, "Password must be at least 8 characters"),
});
export type PasswordResetConfirmValues = z.infer<typeof passwordResetConfirmSchema>;

export const savedPassengerSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(150),
  gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]),
  age: z.coerce.number().int().min(1).max(120),
  cnic_id_number: z.string().trim().max(30).optional().or(z.literal("")),
});
export type SavedPassengerFormValues = z.infer<typeof savedPassengerSchema>;

export const cnicOrPassportRegex = /^(\d{5}-\d{7}-\d|\d{13}|(?=.*\d)[A-Za-z0-9]{6,20})$/;

export const bookingPassengerSchema = z.object({
  seat_id: z.string().uuid(),
  seat_number: z.string().optional(),
  is_ladies_only: z.boolean().optional(),
  passenger_name: z.string().trim().min(2, "Passenger name is required").max(120),
  gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]),
  age: z
    .string()
    .trim()
    .refine((val) => val === "" || (/^\d+$/.test(val) && Number(val) >= 1 && Number(val) <= 120), {
      message: "Age must be between 1 and 120",
    })
    .optional()
    .or(z.literal("")),
  cnic_or_id: z
    .string()
    .trim()
    .min(6, "CNIC or Passport ID is required")
    .max(30)
    .refine((val) => cnicOrPassportRegex.test(val.replace(/\s+/g, "")), {
      message: "Enter a valid 13-digit CNIC (e.g. 35202-1234567-1) or Passport ID",
    }),
});
export type BookingPassengerValues = z.infer<typeof bookingPassengerSchema>;

export const checkoutFormSchema = z
  .object({
    passenger_name: z.string().trim().min(2, "Primary contact name is required").max(120),
    passenger_phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number"),
    passenger_email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .optional()
      .or(z.literal("")),
    coupon_code: z.string().trim().max(50).optional().or(z.literal("")),
    passengers: z.array(bookingPassengerSchema).min(1),
  })
  .superRefine((data, ctx) => {
    data.passengers.forEach((p, idx) => {
      if (p.is_ladies_only && p.gender !== Gender.FEMALE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Seat ${p.seat_number || idx + 1} is Ladies-Only and requires Female gender.`,
          path: ["passengers", idx, "gender"],
        });
      }
    });
  });
export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
