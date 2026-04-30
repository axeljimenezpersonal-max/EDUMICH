import { Router, type IRouter } from "express";
import healthRouter from "./health";
import announcementsRouter from "./announcements";
import documentsRouter from "./documents";
import studentsRouter from "./students";
import coursesRouter from "./courses";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(announcementsRouter);
router.use(documentsRouter);
router.use(studentsRouter);
router.use(coursesRouter);
router.use(dashboardRouter);

export default router;
