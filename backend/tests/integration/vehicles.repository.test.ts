import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Client } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  createVehicle,
  listVehicles,
  InsufficientStockError,
  VehicleNotFoundError,
  purchaseVehicle,
  restockVehicle,
} from "../../src/vehicles/vehicles.repository.js";
import { buildTestDatabaseConfig } from "../helpers/database.js";
import request from "supertest";

import { createApp } from "../../src/app.js";
import type { RegistrationDependencies } from "../../src/auth/registration.service.js";
import { signAccessToken } from "../../src/auth/tokens.js";

const migrationSql = readFileSync(
  new URL("../../migrations/002_create_vehicles.sql", import.meta.url),
  "utf8",
);

async function withVehiclesTable(operation: (client: Client) => Promise<void>): Promise<void> {
  const settings = parse(readFileSync(new URL("../../.env.test", import.meta.url)));

  const client = new Client(
    buildTestDatabaseConfig({
      ...settings,
      NODE_ENV: process.env.NODE_ENV,
    }),
  );

  const schema = `test_vehicle_repo_${randomUUID().replaceAll("-", "")}`;

  try {
    await client.connect();

    const identity = await client.query(
      `
        SELECT
          current_database() AS database,
          current_user AS username,
          rolsuper AS is_superuser
        FROM pg_roles
        WHERE rolname = current_user
      `,
    );

    expect(identity.rows[0]).toEqual({
      database: "dealership_test",
      username: "dealership_test_user",
      is_superuser: false,
    });

    await client.query("BEGIN");

    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      await client.query(migrationSql);

      await operation(client);
    } finally {
      await client.query("ROLLBACK");
    }
  } finally {
    await client.end();
  }
}

describe("vehicles repository", () => {
  it("persists vehicle details and returns the generated ID", async () => {
    await withVehiclesTable(async (client) => {
      const input = {
        make: "O'Brian Motors",
        model: "Tourer",
        category: "SUV",
        price: "45000.25",
        stock: 4,
      };

      const vehicle = await createVehicle(client, input);

      expect(vehicle).toEqual({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
        ...input,
      });

      const stored = await client.query(
        `
          SELECT id, make, model, category, price, stock
          FROM vehicles
          WHERE id = $1
        `,
        [vehicle.id],
      );

      expect(stored.rows).toEqual([vehicle]);
    });
  });

  it("returns an empty list when inventory is empty", async () => {
    await withVehiclesTable(async (client) => {
      await expect(listVehicles(client)).resolves.toEqual([]);
    });
  });

  it("lists all vehicles including zero stock in make, model, and ID order", async () => {
    await withVehiclesTable(async (client) => {
      const firstId = "00000000-0000-4000-8000-000000000001";
      const secondId = "00000000-0000-4000-8000-000000000002";
      const thirdId = "00000000-0000-4000-8000-000000000003";
      const fourthId = "00000000-0000-4000-8000-000000000004";

      const vehicles = [
        {
          id: fourthId,
          make: "Toyota",
          model: "Corolla",
          category: "Sedan",
          price: "25000.50",
          stock: 3,
        },
        {
          id: thirdId,
          make: "Honda",
          model: "Civic",
          category: "Sedan",
          price: "24000.00",
          stock: 0,
        },
        {
          id: secondId,
          make: "Honda",
          model: "Accord",
          category: "Sedan",
          price: "30000.00",
          stock: 2,
        },
        {
          id: firstId,
          make: "Honda",
          model: "Accord",
          category: "Sedan",
          price: "31000.00",
          stock: 1,
        },
      ];

      for (const vehicle of vehicles) {
        await client.query(
          `
            INSERT INTO vehicles (id, make, model, category, price, stock)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [vehicle.id, vehicle.make, vehicle.model, vehicle.category, vehicle.price, vehicle.stock],
        );
      }

      const listed = await listVehicles(client);

      expect(listed).toEqual([vehicles[3], vehicles[2], vehicles[1], vehicles[0]]);
    });
  });
});

describe("vehicle HTTP flow with PostgreSQL", () => {
  const secret = "vehicle-database-test-only-signing-key";
  const userId = "82df1573-4d97-4d4a-a7bb-caf495170d71";

  function appFor(client: Client) {
    return createApp({
      registration: {
        hashPassword: vi.fn<RegistrationDependencies["hashPassword"]>(),
        createUser: vi.fn<RegistrationDependencies["createUser"]>(),
      },
      vehicles: {
        tokenSecret: secret,
        repository: {
          createVehicle: (input) => createVehicle(client, input),
          listVehicles: (filters) => listVehicles(client, filters),
        },
      },
    });
  }

  function authorization(role: "USER" | "ADMIN"): string {
    return `Bearer ${signAccessToken({ id: userId, role }, secret)}`;
  }

  const input = {
    make: "  Toyota  ",
    model: "Corolla",
    category: "Sedan",
    price: "25000.5",
    stock: 0,
  };

  it("persists an administrator-created vehicle and lists it for an ordinary user", async () => {
    await withVehiclesTable(async (client) => {
      const app = appFor(client);

      const created = await request(app)
        .post("/api/vehicles")
        .set("Authorization", authorization("ADMIN"))
        .send(input)
        .expect(201);

      expect(created.body).toEqual({
        vehicle: {
          id: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          ),
          make: "Toyota",
          model: "Corolla",
          category: "Sedan",
          price: "25000.50",
          stock: 0,
        },
      });

      const stored = await client.query(
        "SELECT id, make, model, category, price, stock FROM vehicles",
      );

      expect(stored.rows).toEqual([created.body.vehicle]);

      const listed = await request(app)
        .get("/api/vehicles")
        .set("Authorization", authorization("USER"))
        .expect(200);

      expect(listed.body).toEqual({
        vehicles: [created.body.vehicle],
      });
    });
  });

  it("prevents an ordinary user from inserting a vehicle", async () => {
    await withVehiclesTable(async (client) => {
      await request(appFor(client))
        .post("/api/vehicles")
        .set("Authorization", authorization("USER"))
        .send(input)
        .expect(403);

      const result = await client.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM vehicles",
      );

      expect(result.rows).toEqual([{ count: 0 }]);
    });
  });

  it("prevents invalid administrator input from reaching storage", async () => {
    await withVehiclesTable(async (client) => {
      await request(appFor(client))
        .post("/api/vehicles")
        .set("Authorization", authorization("ADMIN"))
        .send({ ...input, price: "-1.00" })
        .expect(400);

      const result = await client.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM vehicles",
      );

      expect(result.rows).toEqual([{ count: 0 }]);
    });
  });
  it("applies HTTP search filters and rejects a reversed price range", async () => {
    await withVehiclesTable(async (client) => {
      await createVehicle(client, {
        make: "Toyota",
        model: "Corolla",
        category: "Sedan",
        price: "25000.00",
        stock: 0,
      });

      await createVehicle(client, {
        make: "Honda",
        model: "Civic",
        category: "Sedan",
        price: "30000.00",
        stock: 2,
      });

      const app = appFor(client);

      const response = await request(app)
        .get("/api/vehicles/search")
        .set("Authorization", authorization("USER"))
        .query({ make: "toy", maxPrice: "25000.00" })
        .expect(200);

      expect(response.body).toEqual({
        vehicles: [
          {
            id: expect.any(String),
            make: "Toyota",
            model: "Corolla",
            category: "Sedan",
            price: "25000.00",
            stock: 0,
          },
        ],
      });

      await request(app)
        .get("/api/vehicles/search")
        .set("Authorization", authorization("USER"))
        .query({ minPrice: "30000", maxPrice: "25000" })
        .expect(400);
    });
  });
});

describe("vehicle search", () => {
  async function seedInventory(client: Client): Promise<void> {
    const vehicles = [
      {
        make: "Toyota",
        model: "Corolla",
        category: "Sedan",
        price: "25000.00",
        stock: 0,
      },
      {
        make: "Toyota",
        model: "RAV4",
        category: "SUV",
        price: "35000.00",
        stock: 2,
      },
      {
        make: "Honda",
        model: "Civic",
        category: "Sedan",
        price: "30000.00",
        stock: 3,
      },
    ];

    for (const vehicle of vehicles) {
      await createVehicle(client, vehicle);
    }
  }

  it("combines case-insensitive make, model, and category filters", async () => {
    await withVehiclesTable(async (client) => {
      await seedInventory(client);

      const vehicles = await listVehicles(client, {
        make: "TOY",
        model: "roll",
        category: "sedan",
      });

      expect(vehicles).toHaveLength(1);

      expect(vehicles[0]).toMatchObject({
        make: "Toyota",
        model: "Corolla",
        category: "Sedan",
        stock: 0,
      });
    });
  });

  it("includes both price boundaries and excludes vehicles outside the range", async () => {
    await withVehiclesTable(async (client) => {
      await seedInventory(client);

      const vehicles = await listVehicles(client, {
        minPrice: "25000.00",
        maxPrice: "30000.00",
      });

      expect(vehicles.map((vehicle) => vehicle.model)).toEqual(["Civic", "Corolla"]);
    });
  });

  it("returns an empty list when no vehicle matches", async () => {
    await withVehiclesTable(async (client) => {
      await seedInventory(client);

      await expect(listVehicles(client, { make: "Nonexistent" })).resolves.toEqual([]);
    });
  });
  describe("vehicle stock operations", () => {
    const input = {
      make: "Toyota",
      model: "Corolla",
      category: "Sedan",
      price: "25000.00",
      stock: 1,
    };

    it("purchases the last vehicle and rejects another purchase without changing stock", async () => {
      await withVehiclesTable(async (client) => {
        const vehicle = await createVehicle(client, input);

        const purchased = await purchaseVehicle(client, vehicle.id);

        expect(purchased).toEqual({ ...vehicle, stock: 0 });

        await expect(purchaseVehicle(client, vehicle.id)).rejects.toBeInstanceOf(
          InsufficientStockError,
        );

        const stored = await client.query<{ stock: number }>(
          "SELECT stock FROM vehicles WHERE id = $1",
          [vehicle.id],
        );

        expect(stored.rows).toEqual([{ stock: 0 }]);
      });
    });

    it("adds the restock quantity to existing stock and persists it", async () => {
      await withVehiclesTable(async (client) => {
        const vehicle = await createVehicle(client, input);

        const restocked = await restockVehicle(client, vehicle.id, 4);

        expect(restocked).toEqual({ ...vehicle, stock: 5 });

        const stored = await client.query<{ stock: number }>(
          "SELECT stock FROM vehicles WHERE id = $1",
          [vehicle.id],
        );

        expect(stored.rows).toEqual([{ stock: 5 }]);
      });
    });

    it("reports a missing vehicle for purchase and restock", async () => {
      await withVehiclesTable(async (client) => {
        const missingId = randomUUID();

        await expect(purchaseVehicle(client, missingId)).rejects.toBeInstanceOf(
          VehicleNotFoundError,
        );

        await expect(restockVehicle(client, missingId, 2)).rejects.toBeInstanceOf(
          VehicleNotFoundError,
        );
      });
    });
  });
});
