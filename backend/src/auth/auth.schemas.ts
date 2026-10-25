import { z } from "zod";

const registrationSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(12).max(128),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export function parseRegistration(input: unknown): RegistrationInput {
  return registrationSchema.parse(input);
}
export interface LoginInput {
  email: string;
  password: string;
}

export function parseLogin(input: unknown): LoginInput {
  void input;
  throw new Error("Login validation is not implemented.");
}
