import express from "express";
import { createAuthRouter } from "../../routes/auth.route.mjs";
import { createAuthController } from "../../controllers/auth.controller.mjs";

export function createLoginTestApp(authService) {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter(createAuthController(authService)));
  app.use((error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    res
      .status(statusCode)
      .json({ message: error.message || "Internal Server Error" });
  });
  return app;
}
