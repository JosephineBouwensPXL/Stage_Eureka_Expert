import { User, Role, ModeAccess, AuthResponse } from '../types';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';
const CURRENT_USER_KEY = 'studybuddy_auth_user';
const TOKEN_KEY = 'studybuddy_auth_token';
const AUTH_EXPIRED_EVENT = 'studybuddy:auth-expired';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type BackendModeAccess = 'NATIVE' | 'CLASSIC';

type BackendUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  modeAccess: BackendModeAccess;
  isActive: boolean;
  createdAt: string;
};

type BackendAuthResponse = {
  user: BackendUser;
  token: string;
};

const toBackendMode = (mode: ModeAccess): BackendModeAccess =>
  mode === ModeAccess.NATIVE ? 'NATIVE' : 'CLASSIC';

const fromBackendMode = (mode: BackendModeAccess): ModeAccess =>
  mode === 'NATIVE' ? ModeAccess.NATIVE : ModeAccess.CLASSIC;

const mapUser = (user: BackendUser): User => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  modeAccess: fromBackendMode(user.modeAccess),
  isActive: user.isActive,
  createdAt: new Date(user.createdAt),
});

const mapAuthResponse = (response: BackendAuthResponse): AuthResponse => ({
  token: response.token,
  user: mapUser(response.user),
});

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function storeSession(auth: AuthResponse): void {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(auth.user));
  localStorage.setItem(TOKEN_KEY, auth.token);
}

function clearSession(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

function notifyAuthExpired(): void {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequestWithRefresh<T>(path, options, true);
}

let refreshInFlight: Promise<AuthResponse | null> | null = null;

function canAttemptRefresh(path: string): boolean {
  return path !== '/auth/login' && path !== '/auth/register' && path !== '/auth/refresh';
}

async function refreshSession(): Promise<AuthResponse | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        clearSession();
        notifyAuthExpired();
        return null;
      }

      const data = (await response.json()) as BackendAuthResponse;
      const auth = mapAuthResponse(data);
      storeSession(auth);
      return auth;
    } catch {
      clearSession();
      notifyAuthExpired();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function apiRequestWithRefresh<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh: boolean
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      // Keep fallback message
    }
    if (response.status === 401 && allowRefresh && canAttemptRefresh(path)) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return apiRequestWithRefresh<T>(path, options, false);
      }
    }

    if (response.status === 401) {
      clearSession();
      notifyAuthExpired();
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiRequest<BackendAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const auth = mapAuthResponse(response);
    storeSession(auth);
    return auth;
  },

  register: async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    role: Role = Role.STUDENT
  ): Promise<AuthResponse> => {
    const response = await apiRequest<BackendAuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, email, password, role }),
    });

    const auth = mapAuthResponse(response);
    storeSession(auth);
    return auth;
  },

  logout: async () => {
    try {
      await apiRequest<void>('/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Local cleanup still needs to happen.
    }
    clearSession();
  },

  getCurrentUser: (): User | null => {
    const user = localStorage.getItem(CURRENT_USER_KEY);
    if (!user) return null;

    try {
      const parsed = JSON.parse(user) as User;
      return {
        ...parsed,
        firstName: parsed.firstName ?? '',
        lastName: parsed.lastName ?? '',
        createdAt: new Date(parsed.createdAt),
      };
    } catch {
      clearSession();
      return null;
    }
  },

  getUsers: async (search?: string): Promise<User[]> => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const users = await apiRequest<BackendUser[]>(`/users${query}`);
    return users.map(mapUser);
  },

  updateUserStatus: async (id: string, isActive: boolean): Promise<void> => {
    await apiRequest<void>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  updateUserRole: async (id: string, role: Role): Promise<void> => {
    await apiRequest<void>(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  updateUserMode: async (id: string, modeAccess: ModeAccess): Promise<void> => {
    await apiRequest<void>(`/users/${id}/mode`, {
      method: 'PATCH',
      body: JSON.stringify({ modeAccess: toBackendMode(modeAccess) }),
    });
  },

  deleteUser: async (id: string): Promise<void> => {
    await apiRequest<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};

export const authEvents = {
  AUTH_EXPIRED_EVENT,
};
