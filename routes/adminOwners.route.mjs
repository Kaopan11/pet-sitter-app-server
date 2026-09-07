import { Router } from "express";
import { adminOwnersController } from "../controllers/adminOwners.controller.mjs";

const adminOwnersRouter = Router();

/**
 * @openapi
 * /api/admin/owners:
 *   get:
 *     summary: List pet owners for admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
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
 *         description: Admin owner list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not an admin
 */
adminOwnersRouter.get("/", adminOwnersController.list);
adminOwnersRouter.get("/:id", adminOwnersController.getById);
adminOwnersRouter.patch("/:id/ban", adminOwnersController.setBanStatus);
adminOwnersRouter.patch(
  "/:id/pets/:petId/suspend",
  adminOwnersController.setPetSuspended
);

export default adminOwnersRouter;
