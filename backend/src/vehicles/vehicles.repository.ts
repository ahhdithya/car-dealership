import type { Client } from "pg";

import type { CreateVehicleInput } from "./vehicles.schemas.js";

export interface Vehicle extends CreateVehicleInput {
  id: string;
}

export interface VehicleFilters {
  make?: string;
  model?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
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

export async function listVehicles(
  database: Pick<Client, "query">,
  filters: VehicleFilters = {},
): Promise<Vehicle[]> {
  const result = await database.query<Vehicle>(
    `
      SELECT id, make, model, category, price, stock
      FROM vehicles
      WHERE
        ($1::text IS NULL OR strpos(lower(make), lower($1::text)) > 0)
        AND ($2::text IS NULL OR strpos(lower(model), lower($2::text)) > 0)
        AND ($3::text IS NULL OR lower(category) = lower($3::text))
        AND ($4::numeric IS NULL OR price >= $4::numeric)
        AND ($5::numeric IS NULL OR price <= $5::numeric)
      ORDER BY make, model, id
    `,
    [
      filters.make ?? null,
      filters.model ?? null,
      filters.category ?? null,
      filters.minPrice ?? null,
      filters.maxPrice ?? null,
    ],
  );

  return result.rows;
}

export class VehicleNotFoundError extends Error {
  constructor() {
    super("Vehicle not found.");
    this.name = "VehicleNotFoundError";
  }
}

export class InsufficientStockError extends Error {
  constructor() {
    super("Vehicle is out of stock.");
    this.name = "InsufficientStockError";
  }
}

export class StockLimitExceededError extends Error {
  constructor() {
    super("Restocking would exceed the supported stock limit.");
    this.name = "StockLimitExceededError";
  }
}

export async function purchaseVehicle(
  database: Pick<Client, "query">,
  id: string,
): Promise<Vehicle> {
  const result = await database.query<Vehicle>(
    `
      UPDATE vehicles
      SET stock = stock - 1
      WHERE id = $1 AND stock > 0
      RETURNING id, make, model, category, price, stock
    `,
    [id],
  );

  const vehicle = result.rows[0];

  if (vehicle) {
    return vehicle;
  }

  const existing = await database.query("SELECT id FROM vehicles WHERE id = $1", [id]);

  if (existing.rows.length === 0) {
    throw new VehicleNotFoundError();
  }

  throw new InsufficientStockError();
}

export async function restockVehicle(
  database: Pick<Client, "query">,
  id: string,
  quantity: number,
): Promise<Vehicle> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) {
    throw new RangeError("Restock quantity must be a positive supported integer.");
  }

  const result = await database.query<Vehicle>(
    `
      UPDATE vehicles
      SET stock = stock + $2::integer
      WHERE id = $1
        AND stock <= 2147483647 - $2::integer
      RETURNING id, make, model, category, price, stock
    `,
    [id, quantity],
  );

  const vehicle = result.rows[0];

  if (vehicle) {
    return vehicle;
  }

  const existing = await database.query("SELECT id FROM vehicles WHERE id = $1", [id]);

  if (existing.rows.length === 0) {
    throw new VehicleNotFoundError();
  }

  throw new StockLimitExceededError();
}
