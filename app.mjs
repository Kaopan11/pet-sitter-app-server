import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.route.mjs";
import usersRouter from "./routes/users.route.mjs";
import sittersRouter from "./routes/sitters.route.mjs";
import banksRouter from "./routes/banks.route.mjs";
import adminRouter from "./routes/admin.route.mjs";
import petsRouter from "./routes/pets.route.mjs";
import chatRouter from "./routes/chat.route.mjs";
import ownerBookingsRouter from "./routes/ownerBookings.route.mjs";
import stripeWebhookRouter from "./routes/stripeWebhook.route.mjs";
import reportsRouter from "./routes/reports.rout.mjs";
import notificationsRouter from "./routes/notifications.route.mjs";

export function createApp() {
  const app = express();

  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://pet-sitter-app-client-khaki.vercel.app",
  ];

  app.use(
    cors({
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    stripeWebhookRouter
  );

  app.use(express.json({ limit: "2mb" }));
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/sitters", sittersRouter);
  app.use("/api/banks", banksRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/pets", petsRouter);
  app.use("/api/conversations", chatRouter);
  app.use("/api/bookings", ownerBookingsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/notifications", notificationsRouter);

  app.get("/", (req, res) => {
    res.status(200).json({ message: "API is working" });
  });

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      message: "Pet Sitter API is running",
    });
  });

  app.use((error, req, res, next) => {
    console.error(error);
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({
        message:
          "Invalid JSON. For photo upload use form-data and do not set Content-Type to application/json.",
      });
    }
    const statusCode = error.statusCode || 500;
    res
      .status(statusCode)
      .json({ message: error.message || "Internal Server Error" });
  });

  return app;
}
