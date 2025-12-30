import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, getSessionToken, setSessionToken, clearSessionToken, setCurrentWorkspace, getCurrentWorkspace } from './api';
import type { AuthUser, AuthWorkspace, InitialApiKey } from './types';

interface AuthState {
  user: AuthUser | null;
  workspaces: AuthWorkspace[];
  currentWorkspace: AuthWorkspace | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<InitialApiKey | undefined>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    workspaces: [],
    currentWorkspace: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Load user on mount if we have a session token
  useEffect(() => {
    const token = getSessionToken();
    if (token) {
      loadUser();
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const { user, workspaces } = await api.auth.me();
      const savedWorkspaceId = getCurrentWorkspace();
      const currentWorkspace = workspaces.find((w) => w.id === savedWorkspaceId) || workspaces[0] || null;

      if (currentWorkspace && !savedWorkspaceId) {
        setCurrentWorkspace(currentWorkspace.id);
      }

      setState({
        user,
        workspaces,
        currentWorkspace,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      clearSessionToken();
      setState({
        user: null,
        workspaces: [],
        currentWorkspace: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.auth.login({ email, password });

    setSessionToken(response.session.token);

    const currentWorkspace = response.workspaces[0] || null;
    if (currentWorkspace) {
      setCurrentWorkspace(currentWorkspace.id);
    }

    setState({
      user: response.user,
      workspaces: response.workspaces,
      currentWorkspace,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string): Promise<InitialApiKey | undefined> => {
    const response = await api.auth.signup({ email, password, name });

    setSessionToken(response.session.token);

    const currentWorkspace = response.workspaces[0] || null;
    if (currentWorkspace) {
      setCurrentWorkspace(currentWorkspace.id);
    }

    setState({
      user: response.user,
      workspaces: response.workspaces,
      currentWorkspace,
      isLoading: false,
      isAuthenticated: true,
    });

    return response.initialApiKey;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore logout errors
    } finally {
      clearSessionToken();
      setState({
        user: null,
        workspaces: [],
        currentWorkspace: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const switchWorkspace = useCallback((workspaceId: string) => {
    const workspace = state.workspaces.find((w) => w.id === workspaceId);
    if (workspace) {
      setCurrentWorkspace(workspaceId);
      setState((s) => ({ ...s, currentWorkspace: workspace }));
    }
  }, [state.workspaces]);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        logout,
        switchWorkspace,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
