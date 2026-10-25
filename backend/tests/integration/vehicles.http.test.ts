import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { RegistrationDependencies } from "../../src/auth/registration.service.js";
import { signAccessToken } from "../../src/auth/tokens.js";
import type { Vehicle } from "../../src/vehicles/vehicles.repository.js";
import type { VehicleDependencies } from "../../src/vehicles/vehicles.routes.js";

const secret = "vehicle-http-test-only-signing-key";
const userId = "82df1573-4d97-4d4a-a7bb-caf495170d71";

function authorization(role: "USER" | "ADMIN"): string {
  return `Bearer ${signAccessToken({ id: userId, role }, secret)}`;
}

function setup() {
  const vehicle: Vehicle = {
    id: "00000000-0000-4000-8000-000000000001",
    make: "Toyota",
    model: "Corolla",
    category: "Sedan",
    price: "25000.50",
    stock: 3,
  };

  const repository = {
    createVehicle: vi.fn<VehicleDependencies["createVehicle"]>().mockResolvedValue(vehicle),
    listVehicles: vi.fn<VehicleDependencies["listVehicles"]>().mockResolvedValue([vehicle]),
  };

  const app = createApp({
    registration: {
      hashPassword: vi.fn<RegistrationDependencies["hashPassword"]>(),
      createUser: vi.fn<RegistrationDependencies["createUser"]>(),
    },
    vehicles: {
      repository,
      tokenSecret: secret,
    },
  });

  return { app, repository, vehicle };
}

describe("vehicle HTTP endpoints", () => {
  const input = {
    make: "  Toyota  ",
    model: "Corolla",
    category: "Sedan",
    price: "25000.5",
    stock: 3,
  };

  it("allows an administrator to create a validated vehicle", async () => {
    const { app, repository, vehicle } = setup();

    const response = await request(app)
      .post("/api/vehicles")
      .set("Authorization", authorization("ADMIN"))
      .send(input)
      .expect("Content-Type", /json/)
      .expect(201);

    expect(response.body).toEqual({ vehicle });

    expect(repository.createVehicle).toHaveBeenCalledExactlyOnceWith({
      make: "Toyota",
      model: "Corolla",
      category: "Sedan",
      price: "25000.50",
      stock: 3,
    });
  });

  it("rejects vehicle creation without authentication", async () => {
    const { app, repository } = setup();

    const response = await request(app).post("/api/vehicles").send(input).expect(401);

    expect(response.body).toEqual({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "A valid Bearer token is required.",
      },
    });

    expect(repository.createVehicle).not.toHaveBeenCalled();
  });

  it("rejects creation by an ordinary user before validating the body", async () => {
    const { app, repository } = setup();

    const response = await request(app)
      .post("/api/vehicles")
      .set("Authorization", authorization("USER"))
      .send({})
      .expect(403);

    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Administrator access is required.",
      },
    });

    expect(repository.createVehicle).not.toHaveBeenCalled();
  });

  it("rejects invalid vehicle input from an administrator", async () => {
    const { app, repository } = setup();

    const response = await request(app)
      .post("/api/vehicles")
      .set("Authorization", authorization("ADMIN"))
      .send({ ...input, stock: -1 })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body.",
      },
    });

    expect(repository.createVehicle).not.toHaveBeenCalled();
  });

  it.each(["USER", "ADMIN"] as const)("allows a %s to list inventory", async (role) => {
    const { app, repository, vehicle } = setup();

    const response = await request(app)
      .get("/api/vehicles")
      .set("Authorization", authorization(role))
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toEqual({ vehicles: [vehicle] });
    expect(repository.listVehicles).toHaveBeenCalledExactlyOnceWith();
  });

  it("returns an empty inventory array", async () => {
    const { app, repository } = setup();
    repository.listVehicles.mockResolvedValue([]);

    const response = await request(app)
      .get("/api/vehicles")
      .set("Authorization", authorization("USER"))
      .expect(200);

    expect(response.body).toEqual({ vehicles: [] });
  });

  it("rejects inventory listing without authentication", async () => {
    const { app, repository } = setup();

    await request(app).get("/api/vehicles").expect(401);

    expect(repository.listVehicles).not.toHaveBeenCalled();
  });

  it("rejects inventory listing with an invalid token", async () => {
    const { app, repository } = setup();

    await request(app)
      .get("/api/vehicles")
      .set("Authorization", "Bearer invalid-token")
      .expect(401);

    expect(repository.listVehicles).not.toHaveBeenCalled();
  });

  it("returns a generic error when inventory retrieval fails", async () => {
    const { app, repository } = setup();

    repository.listVehicles.mockRejectedValue(new Error("Internal database details"));

    const response = await request(app)
      .get("/api/vehicles")
      .set("Authorization", authorization("USER"))
      .expect(500);

    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });
});
