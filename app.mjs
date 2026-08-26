import "dotenv/config"; // โหลดค่าจาก .env ก่อนทุกอย่าง
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.route.mjs";
import usersRouter from "./routes/users.route.mjs";
import sittersRouter from "./routes/sitters.route.mjs";
import petsRouter from "./routes/pets.route.mjs";
import ownerBookingsRouter from "./routes/ownerBookings.route.mjs";
import stripeWebhookRouter from "./routes/stripeWebhook.route.mjs";

const app = express();
const PORT = process.env.PORT || 4000;

// Frontend ที่อนุญาตให้เรียก API ได้
const allowedOrigins = [
  "http://localhost:3000",
  "https://pet-sitter-app-client-khaki.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Stripe webhook ต้องได้ raw body ก่อน express.json()
app.use(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookRouter
);

app.use(express.json({ limit: "2mb" })); // อ่าน JSON จาก request body (dev: upload limit)
app.use("/api/auth", authRouter); // register / login
app.use("/api/users", usersRouter); // รายการ users
app.use("/api/sitters", sittersRouter); // sitter list + profile + booking list
app.use("/api/pets", petsRouter); // pet list + profile
app.use("/api/bookings", ownerBookingsRouter); // owner create booking (cash | stripe)

app.get("/", (req, res) => {
  res.status(200).json({ message: "API is working" });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Pet Sitter API is running",
  });
});

// จับ error จาก service/controller แล้วส่ง { message }
app.use((error, req, res, next) => {
  console.error(error);
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      message:
        "Invalid JSON. For photo upload use form-data and do not set Content-Type to application/json.",
    });
  }
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ message: error.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
