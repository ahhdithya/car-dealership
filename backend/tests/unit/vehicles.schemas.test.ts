import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseCreateVehicle } from "../../src/vehicles/vehicles.schemas.js";

describe("vehicle creation input validation", () => {
  const validInput = {
    make: "Toyota",
    model: "Corolla",
    category: "Sedan",
    price: "25000.50",
    stock: 3,
  };

  it.each([
    { price: "25000", expected: "25000.00" },
    { price: "25000.5", expected: "25000.50" },
    { price: "25000.50", expected: "25000.50" },
  ])("trims vehicle details and normalizes price $price", ({ price, expected }) => {
    expect(
      parseCreateVehicle({
        make: "  Toyota  ",
        model: "  Corolla  ",
        category: "  Sedan  ",
        price,
        stock: 3,
      }),
    ).toEqual({
      ...validInput,
      price: expected,
    });
  });

  it("defaults omitted stock to zero", () => {
    expect(
      parseCreateVehicle({
        make: "Toyota",
        model: "Corolla",
        category: "Sedan",
        price: "25000.50",
      }),
    ).toEqual({
      ...validInput,
      stock: 0,
    });
  });

  it("accepts the maximum supported price and stock", () => {
    expect(
      parseCreateVehicle({
        ...validInput,
        price: "9999999999.99",
        stock: 2147483647,
      }),
    ).toEqual({
      ...validInput,
      price: "9999999999.99",
      stock: 2147483647,
    });
  });

  it.each([
    {
      description: "a blank make",
      input: { ...validInput, make: "   " },
    },
    {
      description: "a blank model",
      input: { ...validInput, model: "" },
    },
    {
      description: "a blank category",
      input: { ...validInput, category: "   " },
    },
    {
      description: "a make longer than 100 characters",
      input: { ...validInput, make: "a".repeat(101) },
    },
    {
      description: "a zero price",
      input: { ...validInput, price: "0.00" },
    },
    {
      description: "a negative price",
      input: { ...validInput, price: "-1.00" },
    },
    {
      description: "more than two price decimal places",
      input: { ...validInput, price: "25000.501" },
    },
    {
      description: "a price exceeding the database limit",
      input: { ...validInput, price: "10000000000.00" },
    },
    {
      description: "a numeric price instead of a decimal string",
      input: { ...validInput, price: 25000.5 },
    },
    {
      description: "negative stock",
      input: { ...validInput, stock: -1 },
    },
    {
      description: "fractional stock",
      input: { ...validInput, stock: 1.5 },
    },
    {
      description: "stock exceeding the database integer limit",
      input: { ...validInput, stock: 2147483648 },
    },
    {
      description: "stock supplied as a string",
      input: { ...validInput, stock: "3" },
    },
    {
      description: "an unexpected field",
      input: { ...validInput, owner: "someone" },
    },
    {
      description: "a null body",
      input: null,
    },
  ])("rejects $description", ({ input }) => {
    expect(() => parseCreateVehicle(input)).toThrow(ZodError);
  });
});
