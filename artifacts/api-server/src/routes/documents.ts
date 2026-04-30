import { Router } from "express";
import { db, documentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateDocumentBody,
  DeleteDocumentParams,
  ListDocumentsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/documents", async (req, res) => {
  try {
    const params = ListDocumentsQueryParams.safeParse(req.query);
    let query = db.select().from(documentsTable).orderBy(desc(documentsTable.createdAt));
    const rows = await query;
    const studentId = params.success ? params.data.studentId : undefined;
    const type = params.success ? params.data.type : undefined;
    let filtered = rows;
    if (studentId) filtered = filtered.filter((r) => r.studentId === studentId);
    if (type) filtered = filtered.filter((r) => r.documentType === type);
    res.json(filtered);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/documents", async (req, res) => {
  try {
    const body = CreateDocumentBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error });
      return;
    }
    const [created] = await db
      .insert(documentsTable)
      .values({
        studentId: body.data.studentId,
        studentName: body.data.studentName,
        fileName: body.data.fileName,
        fileType: body.data.fileType,
        fileSize: body.data.fileSize,
        documentType: body.data.documentType,
        description: body.data.description,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    const params = DeleteDocumentParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(documentsTable).where(eq(documentsTable.id, params.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
