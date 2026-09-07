import { Router } from "express";
import { adminSittersController } from "../controllers/adminSitters.controller.mjs";

const adminSittersRouter = Router();

/**
 * @openapi
 * /api/admin/sitters:
 *   get:
 *     summary: List sitters for admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 8
 *     responses:
 *       200:
 *         description: Admin sitter list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not an admin
 */
adminSittersRouter.get("/", adminSittersController.list);
adminSittersRouter.get("/:id/bookings", adminSittersController.listBookings);
adminSittersRouter.get("/:id/bookings/:bookingId", adminSittersController.getBookingById);
adminSittersRouter.get("/:id/reviews", adminSittersController.listReviews);
adminSittersRouter.patch("/:id/reviews/:reviewId", adminSittersController.approveReview);
adminSittersRouter.delete("/:id/reviews/:reviewId", adminSittersController.deleteReview);
adminSittersRouter.get("/:id", adminSittersController.getById);
adminSittersRouter.patch("/:id/status", adminSittersController.updateStatus);

export default adminSittersRouter;
