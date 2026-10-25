export async function hashPassword(password: string): Promise<string> {
  void password;
  throw new Error("Password hashing is not implemented.");
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  void hash;
  void password;
  throw new Error("Password verification is not implemented.");
}
