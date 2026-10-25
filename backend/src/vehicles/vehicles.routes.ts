import { Router } from "express";

import { authenticate, requireAdmin } from "../auth/auth.middleware.js";
import type { Vehicle } from "./vehicles.repository.js";
import { parseCreateVehicle } from "./vehicles.schemas.js";
import type { CreateVehicleInput } from "./vehicles.schemas.js";

export interface VehicleDependencies {
  createVehicle: (input: CreateVehicleInput) => Promise<Vehicle>;
  listVehicles: () => Promise<Vehicle[]>;
}

export function createVehicleRouter(
  dependencies: VehicleDependencies,
  tokenSecret: string,
): Router {
  const router = Router();

  router.use(authenticate(tokenSecret));

  router.get("/", async (_request, response) => {
    const vehicles = await dependencies.listVehicles();

    response.status(200).json({ vehicles });
  });

  router.post("/", requireAdmin, async (request, response) => {
    const input = parseCreateVehicle(request.body);
    const vehicle = await dependencies.createVehicle(input);

    response.status(201).json({ vehicle });
  });

  return router;
}
