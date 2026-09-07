import { Router } from "express";
import { sittersController } from "../controllers/sitters.controller.mjs";
import { requireAuth, requireSitter } from "../middlewares/auth.middleware.mjs";
import { uploadSitterImages } from "../middlewares/uploadSitterImages.mjs";
import { uploadBookBankImage } from "../middlewares/uploadBookBankImage.mjs";
import bookingsRouter from "./bookings.route.mjs";

const sittersRouter = Router();

/**
 * @openapi
 * /api/sitters:
 *   get:
 *     summary: Get sitters list
 *     tags: [Sitters]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search name or area
 *       - in: query
 *         name: petTypes
 *         schema:
 *           type: string
 *           example: dog,cat
 *       - in: query
 *         name: rating
 *         schema:
 *           type: string
 *           example: 4,5
 *       - in: query
 *         name: experience
 *         schema:
 *           type: string
 *           example: 3-5
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Sitter list with pagination
 *       500:
 *         description: Database connection error
 */

// GET /api/sitters — endpoint หลักของหน้า Landing page: ดึงรายชื่อ sitter
// พร้อมรองรับค้นหา (q), กรอง petTypes/rating/experience และแบ่งหน้า (page, limit)
sittersRouter.get("/", sittersController.list);

/**
 * @openapi
 * /api/sitters/me:
 *   get:
 *     summary: Get my sitter profile
 *     tags: [Sitters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sitter profile
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a sitter
 */
sittersRouter.get(
  "/me",
  requireAuth,
  requireSitter,
  sittersController.getMyProfile
);

/**
 * @openapi
 * /api/sitters/me/payout:
 *   get:
 *     summary: Get my payout dashboard
 *     tags: [Payout]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Earnings and transactions
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a sitter
 */
sittersRouter.get(
  "/me/payout",
  requireAuth,
  requireSitter,
  sittersController.getMyPayout
);

/**
 * @openapi
 * /api/sitters/me/payout/bank-account:
 *   get:
 *     summary: Get my payout bank account
 *     tags: [Payout]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bank account (masked) or null
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a sitter
 *   put:
 *     summary: Update my payout bank account
 *     tags: [Payout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankCode, accountNumber, accountName, bookBankImageUrl]
 *             properties:
 *               bankCode:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               accountName:
 *                 type: string
 *               bookBankImageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bank account updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a sitter
 */
sittersRouter.get(
  "/me/payout/bank-account",
  requireAuth,
  requireSitter,
  sittersController.getMyPayoutBankAccount
);
sittersRouter.put(
  "/me/payout/bank-account",
  requireAuth,
  requireSitter,
  sittersController.updateMyPayoutBankAccount
);

/**
 * @openapi
 * /api/sitters/me/payout/book-bank-image:
 *   post:
 *     summary: Upload book bank image
 *     tags: [Payout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               bookBankImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image URL
 *       400:
 *         description: Image is required or invalid
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a sitter
 */
sittersRouter.post(
  "/me/payout/book-bank-image",
  [uploadBookBankImage, requireAuth, requireSitter],
  sittersController.uploadMyPayoutBookBankImage
);
sittersRouter.put(
  "/me",
  [uploadSitterImages, requireAuth, requireSitter],
  sittersController.updateMyProfile
);

sittersRouter.use("/bookings", bookingsRouter);
// ต้องวาง /me และ /bookings ก่อน /:id เพราะ Express อ่านบนลงล่าง

/**
 * @openapi
 * /api/sitters/{id}:
 *   get:
 *     summary: Get public sitter profile by id
 *     tags: [Sitters]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sitter profile
 *       404:
 *         description: Sitter not found
 */
sittersRouter.get("/:id", sittersController.getById);
sittersRouter.get("/:id/reviews", sittersController.getReviews);
sittersRouter.get("/:id/availability", sittersController.getAvailability);

export default sittersRouter;
