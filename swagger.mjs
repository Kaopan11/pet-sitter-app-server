import swaggerJsdoc from "swagger-jsdoc";

//Swagger definition
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
    apis: ["./routes/*.mjs"], // อ่าน comment ในไฟล์ route
  });