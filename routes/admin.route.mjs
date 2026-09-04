import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware.mjs";
import adminSittersRouter from "./adminSitters.route.mjs";
import adminOwnersRouter from "./adminOwners.route.mjs";

const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);
adminRouter.use("/sitters", adminSittersRouter);
adminRouter.use("/owners", adminOwnersRouter);
// หน้าอื่นต่อตรงนี้ เช่น /reports

export default adminRouter;
