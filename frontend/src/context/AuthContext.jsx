import { createContext, useContext, useState, useEffect } from 'react';
import {
  setAuthToken,
  loginRequest,
  registerRequest,
  logoutRequest,
  fetchCurrentUser,
} from '@/services/api';

const AuthCtx = createContext({
  user: null,
  token: null,
  loading: false,
  login: () => {},
  logout: () => {},
  register: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null,
  );
  const [loading, setLoading] = useState(true);

  // useEffect (not useLayoutEffect): Next.js renders AuthProvider on the server too; layout effects warn on SSR.
  // Token is also applied synchronously in api.js (localStorage) and in login/register (setAuthToken).
  useEffect(() => {
    setAuthToken(token);
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }, [token]);

  // Check if user is logged in on mount
  useEffect(() => {
    const init = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await fetchCurrentUser();
        setUser(data.user);
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const { data } = await loginRequest({ email, password });
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (
    name,
    email,
    password,
    passwordConfirmation,
    role,
    phone = '',
    address = '',
  ) => {
    const { data } = await registerRequest({
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
      role,
      phone,
      address,
    });
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}

