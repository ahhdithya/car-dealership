import { z } from "zod";

const registrationSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(12).max(128),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export function parseRegistration(input: unknown): RegistrationInput {
  return registrationSchema.parse(input);
}
const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export function parseLogin(input: unknown): LoginInput {
  return loginSchema.parse(input);
}
