import { Router } from "express";
import { db, coursesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { CreateCourseBody } from "@workspace/api-zod";

const router = Router();

router.get("/courses", async (req, res) => {
  try {
    const rows = await db.select().from(coursesTable).orderBy(desc(coursesTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/courses", async (req, res) => {
  try {
    const body = CreateCourseBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error });
      return;
    }
    const [created] = await db
      .insert(coursesTable)
      .values({
        code: body.data.code,
        name: body.data.name,
        professor: body.data.professor,
        credits: body.data.credits,
        schedule: body.data.schedule,
        room: body.data.room,
        semester: body.data.semester,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
