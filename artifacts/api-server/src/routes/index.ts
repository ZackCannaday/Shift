import { Router, type IRouter } from "express";
import healthRouter from "./health";
import visitorsRouter from "./visitors";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(visitorsRouter);
router.use(dashboardRouter);

export default router;
