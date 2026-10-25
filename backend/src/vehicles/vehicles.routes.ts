import { Router } from "express";

import type { Vehicle } from "./vehicles.repository.js";
import type { CreateVehicleInput } from "./vehicles.schemas.js";

export interface VehicleDependencies {
  createVehicle: (input: CreateVehicleInput) => Promise<Vehicle>;
  listVehicles: () => Promise<Vehicle[]>;
}

export function createVehicleRouter(
  dependencies: VehicleDependencies,
  tokenSecret: string,
): Router {
  void dependencies;
  void tokenSecret;

  return Router();
}
