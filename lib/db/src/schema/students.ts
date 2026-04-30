import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentStatusEnum = pgEnum("student_status", ["active", "inactive", "graduated"]);

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  matricula: text("matricula").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  program: text("program").notNull(),
  semester: integer("semester").notNull(),
  campus: text("campus").notNull(),
  status: studentStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
