import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import swaggerJsdoc from "swagger-jsdoc";

const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "routes");
const routeFiles = fs
  .readdirSync(routesDir)
  .filter((name) => name.endsWith(".mjs"))
  .map((name) => path.join(routesDir, name));

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Pet Sitter API Documentation",
      version: "1.0.0",
      description: "API for pet owner, sitter, booking, and admin documentation",
    },
    servers: [{ url: "http://localhost:4000" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: routeFiles,
});
