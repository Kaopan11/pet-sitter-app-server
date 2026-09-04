import express from "express";
import { Router } from "express";
import { createSittersController } from "../../controllers/sitters.controller.mjs";
import { createBanksController } from "../../controllers/banks.controller.mjs";
import { uploadBookBankImage } from "../../middlewares/uploadBookBankImage.mjs";

const AUTH_SESSIONS = {
  "sitter-token": {
    user: { id: "sitter-1", is_banned: false },
    isSitter: true,
  },
  "owner-token": {
    user: { id: "owner-1", is_banned: false },
    isSitter: false,
  },
  "banned-token": {
    user: { id: "banned-1", is_banned: true },
    isSitter: true,
  },
};

function mockRequireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = header.slice(7);
  const session = AUTH_SESSIONS[token];
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (session.user.is_banned) {
    return res
      .status(403)
      .json({ message: "This account has been banned" });
  }

  req.user = session.user;
  next();
}

function mockRequireSitter(req, res, next) {
  const token = req.headers.authorization?.slice(7);
  const session = AUTH_SESSIONS[token];
  if (!session?.isSitter) {
    return res
      .status(403)
      .json({ message: "Forbidden: You are not a sitter" });
  }

  req.sitter = { user_id: session.user.id };
  next();
}

export function createPayoutTestApp({
  payoutService,
  payoutBankService,
} = {}) {
  const controller = createSittersController({
    payout: payoutService,
    payoutBank: payoutBankService,
  });
  const banks = createBanksController({ payoutBank: payoutBankService });

  const app = express();
  app.use(express.json());

  const sittersRouter = Router();
  sittersRouter.get(
    "/me/payout",
    mockRequireAuth,
    mockRequireSitter,
    controller.getMyPayout
  );
  sittersRouter.get(
    "/me/payout/bank-account",
    mockRequireAuth,
    mockRequireSitter,
    controller.getMyPayoutBankAccount
  );
  sittersRouter.put(
    "/me/payout/bank-account",
    mockRequireAuth,
    mockRequireSitter,
    controller.updateMyPayoutBankAccount
  );
  sittersRouter.post(
    "/me/payout/book-bank-image",
    uploadBookBankImage,
    mockRequireAuth,
    mockRequireSitter,
    controller.uploadMyPayoutBookBankImage
  );

  const banksRouter = Router();
  banksRouter.get("/", banks.list);

  app.use("/api/sitters", sittersRouter);
  app.use("/api/banks", banksRouter);

  app.use((error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    res
      .status(statusCode)
      .json({ message: error.message || "Internal Server Error" });
  });

  return app;
}

export const sitterAuth = "Bearer sitter-token";
export const ownerAuth = "Bearer owner-token";
export const bannedAuth = "Bearer banned-token";
