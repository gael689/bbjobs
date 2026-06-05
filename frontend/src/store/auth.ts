import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'company' | 'candidate';
  is_verified?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  
  login: (userData, token) => {
    // Note: The token is typically stored in memory via api interceptor
    // but the store holds the user state for React components.
    set({ user: userData, isAuthenticated: true, isLoading: false });
  },
  
  logout: () => {
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
}));
