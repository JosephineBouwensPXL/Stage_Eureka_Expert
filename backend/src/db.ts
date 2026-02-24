import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, "../data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "studybuddy.sqlite");
const isDevelopment = process.env.NODE_ENV === "development";
const seedPassword = process.env.SEED_USER_PASSWORD;
const NON_LOGINABLE_PASSWORD_HASH = bcrypt.hashSync(`disabled-${Date.now()}`, 10);
const seedPasswordHash = seedPassword ? bcrypt.hashSync(seedPassword, 10) : null;

export const db: Database.Database = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STUDENT')),
    mode_access TEXT NOT NULL CHECK (mode_access IN ('NATIVE', 'CLASSIC')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classrooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS classroom_students (
    class_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    PRIMARY KEY (class_id, student_id),
    FOREIGN KEY (class_id) REFERENCES classrooms (id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);

const usersTableColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
const hasFirstNameColumn = usersTableColumns.some((column) => column.name === "first_name");
if (!hasFirstNameColumn) {
  db.exec("ALTER TABLE users ADD COLUMN first_name TEXT");
}

const hasLastNameColumn = usersTableColumns.some((column) => column.name === "last_name");
if (!hasLastNameColumn) {
  db.exec("ALTER TABLE users ADD COLUMN last_name TEXT");
}

const hasPasswordHashColumn = usersTableColumns.some((column) => column.name === "password_hash");
if (!hasPasswordHashColumn) {
  db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
}

db.prepare(
  "UPDATE users SET first_name = COALESCE(NULLIF(trim(first_name), ''), 'Voornaam')"
).run();
db.prepare(
  "UPDATE users SET last_name = COALESCE(NULLIF(trim(last_name), ''), 'Achternaam')"
).run();

db.prepare(
  "UPDATE users SET password_hash = ? WHERE password_hash IS NULL OR trim(password_hash) = ''"
).run(NON_LOGINABLE_PASSWORD_HASH);
db.prepare("UPDATE users SET role = 'STUDENT' WHERE role = 'TEACHER'").run();

const usersColumnOrder = db.prepare("PRAGMA table_info(users)").all() as Array<{
  cid: number;
  name: string;
}>;
const firstNameIndex = usersColumnOrder.find((column) => column.name === "first_name")?.cid ?? -1;
const lastNameIndex = usersColumnOrder.find((column) => column.name === "last_name")?.cid ?? -1;
const emailIndex = usersColumnOrder.find((column) => column.name === "email")?.cid ?? -1;
const shouldReorderUsersTable =
  firstNameIndex !== 1 || lastNameIndex !== 2 || emailIndex !== 3;

if (shouldReorderUsersTable) {
  const reorderUsersTable = db.transaction(() => {
    db.exec(`
      CREATE TABLE users_reordered (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STUDENT')),
        mode_access TEXT NOT NULL CHECK (mode_access IN ('NATIVE', 'CLASSIC')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
    `);

    db.exec(`
      INSERT INTO users_reordered (id, first_name, last_name, email, password_hash, role, mode_access, is_active, created_at)
      SELECT
        id,
        COALESCE(NULLIF(trim(first_name), ''), 'Voornaam'),
        COALESCE(NULLIF(trim(last_name), ''), 'Achternaam'),
        email,
        COALESCE(NULLIF(trim(password_hash), ''), '${NON_LOGINABLE_PASSWORD_HASH}'),
        role,
        mode_access,
        is_active,
        created_at
      FROM users;
    `);

    db.exec("DROP TABLE users;");
    db.exec("ALTER TABLE users_reordered RENAME TO users;");
  });

  db.pragma("foreign_keys = OFF");
  try {
    reorderUsersTable();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

const userIds = db.prepare("SELECT id FROM users ORDER BY rowid ASC").all() as Array<{ id: string }>;
const hasNonNumericUserId = userIds.some((user) => !/^\d+$/.test(user.id));
if (hasNonNumericUserId) {
  const migrationPlan = userIds.map((user, index) => ({
    oldId: user.id,
    tempId: `__migr_user_${index + 1}`,
    newId: String(index + 1),
  }));

  const setUserIdStmt = db.prepare("UPDATE users SET id = ? WHERE id = ?");
  const setTeacherIdStmt = db.prepare("UPDATE classrooms SET teacher_id = ? WHERE teacher_id = ?");
  const setStudentIdStmt = db.prepare("UPDATE classroom_students SET student_id = ? WHERE student_id = ?");

  const migrateIds = db.transaction(() => {
    for (const row of migrationPlan) {
      setUserIdStmt.run(row.tempId, row.oldId);
    }

    for (const row of migrationPlan) {
      setTeacherIdStmt.run(row.newId, row.oldId);
      setStudentIdStmt.run(row.newId, row.oldId);
    }

    for (const row of migrationPlan) {
      setUserIdStmt.run(row.newId, row.tempId);
    }
  });

  db.pragma("foreign_keys = OFF");
  try {
    migrateIds();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

const countUsersStmt = db.prepare("SELECT COUNT(*) as count FROM users");
const insertUserStmt = db.prepare(`
  INSERT INTO users (id, first_name, last_name, email, password_hash, role, mode_access, is_active, created_at)
  VALUES (@id, @first_name, @last_name, @email, @password_hash, @role, @mode_access, @is_active, @created_at)
`);

const countRow = countUsersStmt.get() as { count: number };
if (countRow.count === 0 && isDevelopment && seedPasswordHash) {
  const now = new Date().toISOString();
  const seedUsers = [
    {
      id: "1",
      first_name: "Admin",
      last_name: "User",
      email: "admin@cleverkids.nl",
      password_hash: seedPasswordHash,
      role: "ADMIN",
      mode_access: "NATIVE",
      is_active: 1,
      created_at: now,
    },
    {
      id: "2",
      first_name: "Voorbeeld",
      last_name: "Student",
      email: "student1@school.nl",
      password_hash: seedPasswordHash,
      role: "STUDENT",
      mode_access: "NATIVE",
      is_active: 1,
      created_at: now,
    },
    {
      id: "3",
      first_name: "Paultje",
      last_name: "Student",
      email: "paultje@school.nl",
      password_hash: seedPasswordHash,
      role: "STUDENT",
      mode_access: "CLASSIC",
      is_active: 1,
      created_at: now,
    },
  ] as const;

  const seed = db.transaction(() => {
    for (const user of seedUsers) {
      insertUserStmt.run(user);
    }
  });

  seed();
}

if (countRow.count === 0 && isDevelopment && !seedPassword) {
  console.warn("SEED_USER_PASSWORD ontbreekt. Seed users zijn niet aangemaakt.");
}
