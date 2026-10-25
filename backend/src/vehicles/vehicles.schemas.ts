export interface CreateVehicleInput {
  make: string;
  model: string;
  category: string;
  price: string;
  stock: number;
}

export function parseCreateVehicle(input: unknown): CreateVehicleInput {
  void input;
  throw new Error("Vehicle validation is not implemented.");
}
