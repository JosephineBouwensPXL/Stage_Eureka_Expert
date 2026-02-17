export enum Role {
  ADMIN = "ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
}

export enum ModeAccess {
  NATIVE = "NATIVE",
  CLASSIC = "CLASSIC",
}

export type User = {
  id: string;
  email: string;
  role: Role;
  modeAccess: ModeAccess;
  isActive: boolean;
  createdAt: string; // ISO string
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type Classroom = {
  id: string;
  name: string;
  teacherId: string;
  studentIds: string[];
};
