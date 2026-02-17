import { Router } from "express";
import { store } from "../store.js";
import type { Classroom } from "../types.js";

export const classroomsRouter = Router();

/**
 * @openapi
 * /classrooms:
 *   get:
 *     tags: [Classrooms]
 *     summary: Klassen ophalen voor een teacher
 *     parameters:
 *       - in: query
 *         name: teacherId
 *         required: true
 *         schema: { type: string }
 */
classroomsRouter.get("/", (req, res) => {
  const teacherId = String(req.query.teacherId ?? "");
  if (!teacherId) return res.status(400).json({ message: "teacherId is verplicht" });
  return res.json(store.classrooms.filter((c) => c.teacherId === teacherId));
});

/**
 * @openapi
 * /classrooms:
 *   post:
 *     tags: [Classrooms]
 *     summary: Classroom aanmaken
 */
classroomsRouter.post("/", (req, res) => {
  const { teacherId, name } = req.body as { teacherId: string; name: string };
  if (!teacherId || !name) return res.status(400).json({ message: "teacherId en name zijn verplicht" });

  const newClass: Classroom = {
    id: store.makeId(),
    name,
    teacherId,
    studentIds: [],
  };

  store.classrooms.push(newClass);
  return res.json(newClass);
});

/**
 * @openapi
 * /classrooms/{classId}/students:
 *   post:
 *     tags: [Classrooms]
 *     summary: Student toevoegen aan klas
 */
classroomsRouter.post("/:classId/students", (req, res) => {
  const { classId } = req.params;
  const { studentId } = req.body as { studentId: string };

  const classroom = store.classrooms.find((c) => c.id === classId);
  if (!classroom) return res.status(404).json({ message: "Classroom niet gevonden" });

  if (!classroom.studentIds.includes(studentId)) {
    classroom.studentIds.push(studentId);
  }
  return res.status(204).send();
});
