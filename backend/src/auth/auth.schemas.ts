export interface RegistrationInput {
  email: string;
  password: string;
}

export function parseRegistration(input: unknown): RegistrationInput {
  // Temporary Red-phase scaffold.
  void input;
  throw new Error("Registration validation is not implemented.");
}
