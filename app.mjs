import "dotenv/config"; // โหลดค่าจาก .env ก่อนทุกอย่าง
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.route.mjs";
import usersRouter from "./routes/users.route.mjs";
import sittersRouter from "./routes/sitters.route.mjs";
import chatRouter from "./routes/chat.route.mjs";
import ownerBookingsRouter from "./routes/ownerBookings.route.mjs";
import { startChatListener } from "./services/chatEvents.mjs";

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

app.use(express.json()); // อ่าน JSON จาก request body

app.use("/api/auth", authRouter); // register / login
app.use("/api/users", usersRouter); // รายการ users
app.use("/api/sitters", sittersRouter); // sitter list + profile + booking list
app.use("/api/conversations", chatRouter); // owner–sitter chat
app.use("/api/bookings", ownerBookingsRouter); // owner booking history

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
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ message: error.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startChatListener().catch((error) => {
    console.error("Chat realtime listener failed:", error.message);
  });
});
