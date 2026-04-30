import { Router } from "express";
import { db, announcementsTable, documentsTable, studentsTable, coursesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const [students, announcements, documents, courses] = await Promise.all([
      db.select().from(studentsTable),
      db.select().from(announcementsTable).where(eq(announcementsTable.isActive, true)),
      db.select().from(documentsTable),
      db.select().from(coursesTable),
    ]);

    const activeStudents = students.filter((s) => s.status === "active").length;
    const urgentAnnouncements = announcements.filter((a) => a.priority === "urgent").length;
    const pendingDocuments = documents.filter((d) => d.status === "pending").length;

    const recentAnnouncements = await db
      .select()
      .from(announcementsTable)
      .where(eq(announcementsTable.isActive, true))
      .orderBy(desc(announcementsTable.createdAt))
      .limit(5);

    const recentDocuments = await db
      .select()
      .from(documentsTable)
      .orderBy(desc(documentsTable.createdAt))
      .limit(5);

    res.json({
      totalStudents: students.length,
      activeStudents,
      totalAnnouncements: announcements.length,
      urgentAnnouncements,
      totalDocuments: documents.length,
      pendingDocuments,
      totalCourses: courses.length,
      recentAnnouncements,
      recentDocuments,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
