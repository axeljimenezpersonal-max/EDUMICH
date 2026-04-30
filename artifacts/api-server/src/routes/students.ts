import { Router } from "express";
import { db, studentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateStudentBody,
  GetStudentParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/students", async (req, res) => {
  try {
    const rows = await db.select().from(studentsTable).orderBy(desc(studentsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/students", async (req, res) => {
  try {
    const body = CreateStudentBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error });
      return;
    }
    const [created] = await db
      .insert(studentsTable)
      .values({
        matricula: body.data.matricula,
        firstName: body.data.firstName,
        lastName: body.data.lastName,
        email: body.data.email,
        program: body.data.program,
        semester: body.data.semester,
        campus: body.data.campus,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/students/:id", async (req, res) => {
  try {
    const params = GetStudentParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [student] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, params.data.id));
    if (!student) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(student);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
