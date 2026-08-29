import { Router, type IRouter } from "express";
import healthRouter from "./health";
import visitorsRouter from "./visitors";
import dashboardRouter from "./dashboard";
import keysRouter from "./keys";
import embedRouter from "./embed";
import authRouter from "./auth";
import settingsRouter from "./settings";
import contentRouter from "./content";

const router: IRouter = Router();

router.use(healthRouter);
router.use(visitorsRouter);
router.use(dashboardRouter);
router.use(keysRouter);
router.use(embedRouter);
router.use(authRouter);
router.use(settingsRouter);
router.use(contentRouter);

export default router;
