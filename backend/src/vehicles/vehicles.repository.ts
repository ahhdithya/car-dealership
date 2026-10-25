import type { Client } from "pg";

import type { CreateVehicleInput } from "./vehicles.schemas.js";

export interface Vehicle extends CreateVehicleInput {
  id: string;
}

export async function createVehicle(
  database: Pick<Client, "query">,
  input: CreateVehicleInput,
): Promise<Vehicle> {
  void database;
  void input;
  throw new Error("Vehicle creation is not implemented.");
}

export async function listVehicles(database: Pick<Client, "query">): Promise<Vehicle[]> {
  void database;
  throw new Error("Vehicle listing is not implemented.");
}
