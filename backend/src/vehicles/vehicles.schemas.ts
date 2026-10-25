import { z } from "zod";
import type { VehicleFilters } from "./vehicles.repository.js";
const vehicleTextSchema = z.string().trim().min(1).max(100);

const priceSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
    "Price must be a decimal string with at most two decimal places.",
  )
  .refine((value) => /[1-9]/.test(value), {
    message: "Price must be greater than zero.",
  })
  .transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return `${whole}.${fraction.padEnd(2, "0")}`;
  });

const createVehicleSchema = z.strictObject({
  make: vehicleTextSchema,
  model: vehicleTextSchema,
  category: vehicleTextSchema,
  price: priceSchema,
  stock: z.number().int().min(0).max(2147483647).default(0),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export function parseCreateVehicle(input: unknown): CreateVehicleInput {
  return createVehicleSchema.parse(input);
}
const searchTextSchema = z.string().trim().min(1).max(100);

const searchPriceSchema = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);

const vehicleFiltersSchema = z
  .strictObject({
    make: searchTextSchema.optional(),
    model: searchTextSchema.optional(),
    category: searchTextSchema.optional(),
    minPrice: searchPriceSchema.optional(),
    maxPrice: searchPriceSchema.optional(),
  })
  .refine(
    (filters) =>
      filters.minPrice === undefined ||
      filters.maxPrice === undefined ||
      Number(filters.minPrice) <= Number(filters.maxPrice),
    {
      message: "Minimum price must not exceed maximum price.",
      path: ["maxPrice"],
    },
  );

export function parseVehicleFilters(input: unknown): VehicleFilters {
  const parsed = vehicleFiltersSchema.parse(input);
  const filters: VehicleFilters = {};

  if (parsed.make !== undefined) filters.make = parsed.make;
  if (parsed.model !== undefined) filters.model = parsed.model;
  if (parsed.category !== undefined) filters.category = parsed.category;
  if (parsed.minPrice !== undefined) filters.minPrice = parsed.minPrice;
  if (parsed.maxPrice !== undefined) filters.maxPrice = parsed.maxPrice;

  return filters;
}
const vehicleIdSchema = z.string().uuid();

const restockVehicleSchema = z.strictObject({
  quantity: z.number().int().min(1).max(2147483647),
});

export function parseVehicleId(input: unknown): string {
  return vehicleIdSchema.parse(input);
}

export function parseRestockVehicle(input: unknown): { quantity: number } {
  return restockVehicleSchema.parse(input);
}
