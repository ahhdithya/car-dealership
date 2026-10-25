import { Router } from "express";

import { authenticate, requireAdmin } from "../auth/auth.middleware.js";
import type { Vehicle, VehicleFilters } from "./vehicles.repository.js";
import {
  parseCreateVehicle,
  parseVehicleFilters,
  parseVehicleId,
  parseRestockVehicle,
  type CreateVehicleInput,
} from "./vehicles.schemas.js";

export interface VehicleDependencies {
  createVehicle(input: CreateVehicleInput): Promise<Vehicle>;
  listVehicles(filters?: VehicleFilters): Promise<Vehicle[]>;
  purchaseVehicle(id: string): Promise<Vehicle>;
  restockVehicle(id: string, quantity: number): Promise<Vehicle>;
}

export function createVehicleRouter(
  dependencies: VehicleDependencies,
  tokenSecret: string,
): Router {
  const router = Router();

  router.use(authenticate(tokenSecret));

  router.get(["/", "/search"], async (request, response) => {
    const filters = parseVehicleFilters(request.query);

    const vehicles =
      Object.keys(filters).length === 0
        ? await dependencies.listVehicles()
        : await dependencies.listVehicles(filters);

    response.status(200).json({ vehicles });
  });

  router.post("/", requireAdmin, async (request, response) => {
    const input = parseCreateVehicle(request.body);
    const vehicle = await dependencies.createVehicle(input);

    response.status(201).json({ vehicle });
  });

  router.post("/:id/purchase", async (request, response) => {
    const id = parseVehicleId(request.params.id);
    const vehicle = await dependencies.purchaseVehicle(id);

    response.status(200).json({ vehicle });
  });

  router.post("/:id/restock", requireAdmin, async (request, response) => {
    const id = parseVehicleId(request.params.id);
    const { quantity } = parseRestockVehicle(request.body);
    const vehicle = await dependencies.restockVehicle(id, quantity);

    response.status(200).json({ vehicle });
  });

  return router;
}
