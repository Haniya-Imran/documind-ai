import bcrypt from "bcryptjs";
import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  password: z.string().min(8, "Use at least 8 characters").max(128)
    .regex(/[A-Za-z]/, "Include at least one letter").regex(/[0-9]/, "Include at least one number"),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password").max(128),
});

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 11);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}
