import { z } from "zod";

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
