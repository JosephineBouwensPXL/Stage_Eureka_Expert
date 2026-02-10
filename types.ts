
export enum Role {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN'
}

export enum ModeAccess {
  NATIVE = 'native',
  CLASSIC = 'classic'
}

export interface User {
  id: string;
  email: string;
  role: Role;
  modeAccess: ModeAccess;
  isActive: boolean;
  createdAt: Date;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export enum MessageRole {
  USER = 'user',
  BOT = 'bot'
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
}

export type StudyItemType = 'file' | 'folder';

export interface StudyItem {
  id: string;
  name: string;
  type: StudyItemType;
  parentId: string | null;
  content?: string; 
  fileType?: string; 
  selected?: boolean; 
  createdAt: Date;
  assignedByEmail?: string; // Who assigned this (teacher)
  isLocked?: boolean; // If true, student cannot delete
}

export interface Classroom {
  id: string;
  name: string;
  teacherId: string;
  studentIds: string[];
}

export interface StudyMaterial {
  title: string;
  content: string;
  lastUpdated: Date;
}
