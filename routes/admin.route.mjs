import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware.mjs";
import adminSittersRouter from "./adminSitters.route.mjs";

const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);
adminRouter.use("/sitters", adminSittersRouter);
// หน้าอื่นต่อตรงนี้ เช่น /owners, /reports

export default adminRouter;
