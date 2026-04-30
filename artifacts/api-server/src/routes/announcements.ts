import { Router } from "express";
import { db, announcementsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  CreateAnnouncementBody,
  GetAnnouncementParams,
  ListAnnouncementsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/announcements/summary", async (req, res) => {
  try {
    const all = await db.select().from(announcementsTable).where(eq(announcementsTable.isActive, true));
    const total = all.length;
    const urgent = all.filter((a) => a.priority === "urgent").length;
    const categoryMap: Record<string, number> = {};
    for (const a of all) {
      categoryMap[a.category] = (categoryMap[a.category] ?? 0) + 1;
    }
    const byCategory = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));
    res.json({ total, urgent, byCategory });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/announcements", async (req, res) => {
  try {
    const params = ListAnnouncementsQueryParams.safeParse(req.query);
    const query = db
      .select()
      .from(announcementsTable)
      .where(eq(announcementsTable.isActive, true))
      .orderBy(desc(announcementsTable.createdAt));
    const rows = await query;
    const category = params.success ? params.data.category : undefined;
    const limit = params.success ? (params.data.limit ?? 20) : 20;
    const filtered = category ? rows.filter((r) => r.category === category) : rows;
    res.json(filtered.slice(0, limit));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/announcements", async (req, res) => {
  try {
    const body = CreateAnnouncementBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body", details: body.error });
      return;
    }
    const [created] = await db
      .insert(announcementsTable)
      .values({
        title: body.data.title,
        content: body.data.content,
        category: body.data.category,
        priority: body.data.priority,
        authorName: body.data.authorName,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/announcements/:id", async (req, res) => {
  try {
    const params = GetAnnouncementParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [announcement] = await db
      .select()
      .from(announcementsTable)
      .where(eq(announcementsTable.id, params.data.id));
    if (!announcement) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(announcement);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
