import "dotenv/config";
import express from "express";
import usersRouter from "./routes/users.route.mjs";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.use("/api/users", usersRouter);

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
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ message: error.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
