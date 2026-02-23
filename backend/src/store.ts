import { db } from "./db.js";
import { ModeAccess, Role, type Classroom, type User } from "./types.js";

const id = () => Math.random().toString(36).substring(2, 11);
const nowISO = () => new Date().toISOString();

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  mode_access: ModeAccess;
  is_active: number;
  created_at: string;
};

type UserAuthRow = UserRow & {
  password_hash: string;
};

type ClassroomRow = {
  id: string;
  name: string;
  teacher_id: string;
};

const listUsersStmt = db.prepare(`
  SELECT id, first_name, last_name, email, role, mode_access, is_active, created_at
  FROM users
  ORDER BY created_at DESC
`);

const searchUsersStmt = db.prepare(`
  SELECT id, first_name, last_name, email, role, mode_access, is_active, created_at
  FROM users
  WHERE lower(email) LIKE '%' || lower(?) || '%'
  ORDER BY created_at DESC
`);

const findUserByEmailStmt = db.prepare(`
  SELECT id, first_name, last_name, email, role, mode_access, is_active, created_at
  FROM users
  WHERE lower(email) = lower(?)
  LIMIT 1
`);

const findAuthUserByEmailStmt = db.prepare(`
  SELECT id, first_name, last_name, email, password_hash, role, mode_access, is_active, created_at
  FROM users
  WHERE lower(email) = lower(?)
  LIMIT 1
`);

const findUserByIdStmt = db.prepare(`
  SELECT id, first_name, last_name, email, role, mode_access, is_active, created_at
  FROM users
  WHERE id = ?
  LIMIT 1
`);

const createUserStmt = db.prepare(`
  INSERT INTO users (id, first_name, last_name, email, password_hash, role, mode_access, is_active, created_at)
  VALUES (@id, @first_name, @last_name, @email, @password_hash, @role, @mode_access, @is_active, @created_at)
`);

const maxUserIdStmt = db.prepare(`
  SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) as max_id
  FROM users
`);
const countAdminsStmt = db.prepare(`
  SELECT COUNT(*) as count
  FROM users
  WHERE role = 'ADMIN'
`);
const countActiveAdminsStmt = db.prepare(`
  SELECT COUNT(*) as count
  FROM users
  WHERE role = 'ADMIN' AND is_active = 1
`);

const updateStatusStmt = db.prepare("UPDATE users SET is_active = ? WHERE id = ?");
const updateRoleStmt = db.prepare("UPDATE users SET role = ? WHERE id = ?");
const updateModeStmt = db.prepare("UPDATE users SET mode_access = ? WHERE id = ?");
const deleteUserStmt = db.prepare("DELETE FROM users WHERE id = ?");
const deleteStudentMembershipStmt = db.prepare("DELETE FROM classroom_students WHERE student_id = ?");
const deleteTeacherClassroomsStmt = db.prepare("DELETE FROM classrooms WHERE teacher_id = ?");

const listClassroomsByTeacherStmt = db.prepare(`
  SELECT id, name, teacher_id
  FROM classrooms
  WHERE teacher_id = ?
  ORDER BY rowid DESC
`);

const createClassroomStmt = db.prepare(
  "INSERT INTO classrooms (id, name, teacher_id) VALUES (@id, @name, @teacher_id)"
);

const findClassroomByIdStmt = db.prepare(
  "SELECT id, name, teacher_id FROM classrooms WHERE id = ? LIMIT 1"
);

const listStudentIdsForClassStmt = db.prepare(
  "SELECT student_id FROM classroom_students WHERE class_id = ?"
);

const addStudentToClassStmt = db.prepare(
  "INSERT OR IGNORE INTO classroom_students (class_id, student_id) VALUES (?, ?)"
);

const deleteUserTransaction = db.transaction((userId: string) => {
  deleteStudentMembershipStmt.run(userId);
  deleteTeacherClassroomsStmt.run(userId);
  deleteUserStmt.run(userId);
});

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    modeAccess: row.mode_access,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

function mapClassroom(row: ClassroomRow): Classroom {
  const students = listStudentIdsForClassStmt.all(row.id) as Array<{ student_id: string }>;
  return {
    id: row.id,
    name: row.name,
    teacherId: row.teacher_id,
    studentIds: students.map((s) => s.student_id),
  };
}

function nextUserId(): string {
  const row = maxUserIdStmt.get() as { max_id: number };
  return String(row.max_id + 1);
}

export const store = {
  makeId: id,
  nowISO,

  listUsers(search?: string): User[] {
    const query = String(search ?? "").trim();
    const rows = (query ? searchUsersStmt.all(query) : listUsersStmt.all()) as UserRow[];
    return rows.map(mapUser);
  },

  findUserByEmail(email: string): User | null {
    const row = findUserByEmailStmt.get(email) as UserRow | undefined;
    return row ? mapUser(row) : null;
  },

  findAuthUserByEmail(email: string): { user: User; passwordHash: string } | null {
    const row = findAuthUserByEmailStmt.get(email) as UserAuthRow | undefined;
    if (!row) return null;
    return {
      user: mapUser(row),
      passwordHash: row.password_hash,
    };
  },

  findUserById(userId: string): User | null {
    const row = findUserByIdStmt.get(userId) as UserRow | undefined;
    return row ? mapUser(row) : null;
  },

  countAdmins(): number {
    const row = countAdminsStmt.get() as { count: number };
    return row.count;
  },

  countActiveAdmins(): number {
    const row = countActiveAdminsStmt.get() as { count: number };
    return row.count;
  },

  createUser(input: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    role: Role;
    modeAccess: ModeAccess;
    isActive: boolean;
  }): User {
    const user: User = {
      id: nextUserId(),
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      role: input.role,
      modeAccess: input.modeAccess,
      isActive: input.isActive,
      createdAt: nowISO(),
    };

    createUserStmt.run({
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      password_hash: input.passwordHash,
      role: user.role,
      mode_access: user.modeAccess,
      is_active: user.isActive ? 1 : 0,
      created_at: user.createdAt,
    });

    return user;
  },

  updateUserStatus(userId: string, isActive: boolean): boolean {
    const result = updateStatusStmt.run(isActive ? 1 : 0, userId);
    return result.changes > 0;
  },

  updateUserRole(userId: string, role: Role): boolean {
    const result = updateRoleStmt.run(role, userId);
    return result.changes > 0;
  },

  updateUserMode(userId: string, modeAccess: ModeAccess): boolean {
    const result = updateModeStmt.run(modeAccess, userId);
    return result.changes > 0;
  },

  deleteUser(userId: string): boolean {
    const before = db.prepare("SELECT 1 FROM users WHERE id = ? LIMIT 1").get(userId) as
      | { 1: number }
      | undefined;
    if (!before) return false;
    deleteUserTransaction(userId);
    return true;
  },

  listClassroomsByTeacher(teacherId: string): Classroom[] {
    const rows = listClassroomsByTeacherStmt.all(teacherId) as ClassroomRow[];
    return rows.map(mapClassroom);
  },

  createClassroom(input: { teacherId: string; name: string }): Classroom {
    const classroom: Classroom = {
      id: id(),
      name: input.name,
      teacherId: input.teacherId,
      studentIds: [],
    };

    createClassroomStmt.run({
      id: classroom.id,
      name: classroom.name,
      teacher_id: classroom.teacherId,
    });

    return classroom;
  },

  classroomExists(classId: string): boolean {
    const row = findClassroomByIdStmt.get(classId) as ClassroomRow | undefined;
    return Boolean(row);
  },

  addStudentToClass(classId: string, studentId: string): boolean {
    const result = addStudentToClassStmt.run(classId, studentId);
    return result.changes > 0;
  },
};
