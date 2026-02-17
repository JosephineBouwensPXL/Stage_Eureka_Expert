import { ModeAccess, Role, type Classroom, type User } from "./types.js";

const nowISO = () => new Date().toISOString();
const id = () => Math.random().toString(36).substring(2, 11);

export const store = {
  users: [
    {
      id: "admin-1",
      email: "admin@cleverkids.nl",
      role: Role.ADMIN,
      modeAccess: ModeAccess.NATIVE,
      isActive: true,
      createdAt: nowISO(),
    },
    {
      id: "teacher-1",
      email: "juf@school.nl",
      role: Role.TEACHER,
      modeAccess: ModeAccess.NATIVE,
      isActive: true,
      createdAt: nowISO(),
    },
    {
      id: "student-1",
      email: "paultje@school.nl",
      role: Role.STUDENT,
      modeAccess: ModeAccess.CLASSIC,
      isActive: true,
      createdAt: nowISO(),
    },
  ] as User[],

  classrooms: [] as Classroom[],

  makeId: id,
  nowISO,
};
