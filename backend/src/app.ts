import express from "express";
import type { Express } from "express";

import type { RegistrationDependencies } from "./auth/registration.service.js";

export interface AppDependencies {
  registration: RegistrationDependencies;
}

export function createApp(dependencies: AppDependencies): Express {
  void dependencies;

  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  return app;
}
