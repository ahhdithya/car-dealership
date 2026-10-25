import type { Client } from "pg";

import type { CreateVehicleInput } from "./vehicles.schemas.js";

export interface Vehicle extends CreateVehicleInput {
  id: string;
}

export async function createVehicle(
  database: Pick<Client, "query">,
  input: CreateVehicleInput,
): Promise<Vehicle> {
  const result = await database.query<Vehicle>(
    `
      INSERT INTO vehicles (make, model, category, price, stock)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, make, model, category, price, stock
    `,
    [input.make, input.model, input.category, input.price, input.stock],
  );

  const vehicle = result.rows[0];

  if (!vehicle) {
    throw new Error("Vehicle creation returned no vehicle.");
  }

  return vehicle;
}

export async function listVehicles(database: Pick<Client, "query">): Promise<Vehicle[]> {
  const result = await database.query<Vehicle>(
    `
      SELECT id, make, model, category, price, stock
      FROM vehicles
      ORDER BY make, model, id
    `,
  );

  return result.rows;
}
