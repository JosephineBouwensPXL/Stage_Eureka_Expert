
import { User, Role, ModeAccess, AuthResponse, Classroom, StudyItem } from '../types';

const USERS_KEY = 'cleverkids_mock_users';
const CURRENT_USER_KEY = 'cleverkids_auth_user';
const CLASSROOMS_KEY = 'cleverkids_mock_classrooms';

const getStoredUsers = (): User[] => {
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) {
    const initialUsers: User[] = [
      {
        id: 'admin-1',
        email: 'admin@cleverkids.nl',
        role: Role.ADMIN,
        modeAccess: ModeAccess.NATIVE,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'teacher-1',
        email: 'juf@school.nl',
        role: Role.TEACHER,
        modeAccess: ModeAccess.NATIVE,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 'student-1',
        email: 'paultje@school.nl',
        role: Role.STUDENT,
        modeAccess: ModeAccess.CLASSIC,
        isActive: true,
        createdAt: new Date()
      }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(initialUsers));
    return initialUsers;
  }
  return JSON.parse(stored).map((u: any) => ({ ...u, createdAt: new Date(u.createdAt) }));
};

const getStoredClassrooms = (): Classroom[] => {
  const stored = localStorage.getItem(CLASSROOMS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const mockApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    await new Promise(r => setTimeout(r, 800));
    const users = getStoredUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) throw new Error('Gebruiker niet gevonden');
    if (!user.isActive) throw new Error('Dit account is gedeactiveerd');
    
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return { user, token: 'mock-jwt-token' };
  },

  register: async (email: string, password: string, role: Role = Role.STUDENT): Promise<AuthResponse> => {
    await new Promise(r => setTimeout(r, 800));
    const users = getStoredUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('E-mail is al in gebruik');
    }

    const newUser: User = {
      id: Math.random().toString(36).substring(2, 11),
      email,
      role,
      modeAccess: ModeAccess.CLASSIC,
      isActive: true,
      createdAt: new Date()
    };

    const updated = [...users, newUser];
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
    return { user: newUser, token: 'mock-jwt-token' };
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const user = localStorage.getItem(CURRENT_USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  getUsers: async (search?: string): Promise<User[]> => {
    const users = getStoredUsers();
    if (!search) return users;
    return users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));
  },

  updateUserStatus: async (id: string, isActive: boolean) => {
    const users = getStoredUsers();
    const updated = users.map(u => u.id === id ? { ...u, isActive } : u);
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
  },

  updateUserRole: async (id: string, role: Role) => {
    const users = getStoredUsers();
    const updated = users.map(u => u.id === id ? { ...u, role } : u);
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
  },

  updateUserMode: async (id: string, modeAccess: ModeAccess) => {
    const users = getStoredUsers();
    const updated = users.map(u => u.id === id ? { ...u, modeAccess } : u);
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
  },

  deleteUser: async (id: string) => {
    const users = getStoredUsers();
    const updated = users.filter(u => u.id !== id);
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
  },

  // Classroom Methods
  getClassrooms: async (teacherId: string): Promise<Classroom[]> => {
    const classes = getStoredClassrooms();
    return classes.filter(c => c.teacherId === teacherId);
  },

  createClassroom: async (teacherId: string, name: string): Promise<Classroom> => {
    const classes = getStoredClassrooms();
    const newClass: Classroom = {
      id: Math.random().toString(36).substring(2, 11),
      name,
      teacherId,
      studentIds: []
    };
    localStorage.setItem(CLASSROOMS_KEY, JSON.stringify([...classes, newClass]));
    return newClass;
  },

  addStudentToClass: async (classId: string, studentId: string) => {
    const classes = getStoredClassrooms();
    const updated = classes.map(c => {
      if (c.id === classId && !c.studentIds.includes(studentId)) {
        return { ...c, studentIds: [...c.studentIds, studentId] };
      }
      return c;
    });
    localStorage.setItem(CLASSROOMS_KEY, JSON.stringify(updated));
  }
};
