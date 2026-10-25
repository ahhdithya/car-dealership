import express from "express";
import type { Express, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { EmailAlreadyRegisteredError, registerUser } from "./auth/registration.service.js";
import type { RegistrationDependencies } from "./auth/registration.service.js";
import type { LoginDependencies } from "./auth/login.service.js";
import { InvalidCredentialsError, loginUser } from "./auth/login.service.js";
export interface AppDependencies {
  registration: RegistrationDependencies;
  login?: LoginDependencies;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  app.post("/api/auth/register", async (request, response) => {
    const user = await registerUser(request.body, dependencies.registration);

    response.status(201).json({ user });
  });
  const login = dependencies.login;

  if (login) {
    app.post("/api/auth/login", async (request, response) => {
      const result = await loginUser(request.body, login);

      response.status(200).json(result);
    });
  }

  app.use((error: unknown, request: Request, response: Response, next: NextFunction): void => {
    void request;

    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body.",
        },
      });
      return;
    }

    if (error instanceof EmailAlreadyRegisteredError) {
      response.status(409).json({
        error: {
          code: "EMAIL_ALREADY_REGISTERED",
          message: error.message,
        },
      });
      return;
    }
    if (error instanceof InvalidCredentialsError) {
      response.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: error.message,
        },
      });
      return;
    }
    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });

  return app;
}
