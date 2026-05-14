import { useCallback, useMemo, useState } from 'react';
import { ACCOUNTS_KEY, SESSION_KEY, readJson, writeJson } from './authStorage';
import { hashPassword } from './cryptoPassword';

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function readAccounts() {
  const list = readJson(ACCOUNTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

function writeAccounts(list) {
  writeJson(ACCOUNTS_KEY, list);
}

function readSessionUser() {
  const session = readJson(SESSION_KEY, null);
  const userId = session?.userId;
  if (!userId) return null;
  const accounts = readAccounts();
  const u = accounts.find((a) => a.id === userId);
  if (!u) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return { id: u.id, email: u.email, displayName: u.displayName };
}

export function useAuth() {
  const [user, setUser] = useState(readSessionUser);

  const persistSession = useCallback((userId) => {
    if (!userId) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    writeJson(SESSION_KEY, { userId });
  }, []);

  const register = useCallback(async ({ displayName, email, password }) => {
    const em = normalizeEmail(email);
    if (!em || !password || password.length < 6) {
      return { ok: false, error: 'E-posta geçerli olmalı; şifre en az 6 karakter.' };
    }
    const name = String(displayName || '').trim() || em.split('@')[0];
    const accounts = readAccounts();
    if (accounts.some((a) => a.email === em)) {
      return { ok: false, error: 'Bu e-posta ile zaten kayıt var.' };
    }
    const id = crypto.randomUUID();
    const salt = crypto.randomUUID();
    const passwordHash = await hashPassword(password, salt);
    const next = [
      ...accounts,
      {
        id,
        email: em,
        displayName: name,
        salt,
        passwordHash,
        createdAt: new Date().toISOString(),
      },
    ];
    writeAccounts(next);
    setUser({ id, email: em, displayName: name });
    persistSession(id);
    return { ok: true };
  }, [persistSession]);

  const login = useCallback(async ({ email, password }) => {
    const em = normalizeEmail(email);
    const accounts = readAccounts();
    const u = accounts.find((a) => a.email === em);
    if (!u) {
      return { ok: false, error: 'E-posta veya şifre hatalı.' };
    }
    const h = await hashPassword(password, u.salt);
    if (h !== u.passwordHash) {
      return { ok: false, error: 'E-posta veya şifre hatalı.' };
    }
    setUser({ id: u.id, email: u.email, displayName: u.displayName });
    persistSession(u.id);
    return { ok: true };
  }, [persistSession]);

  const logout = useCallback(() => {
    setUser(null);
    persistSession(null);
  }, [persistSession]);

  return useMemo(
    () => ({
      user,
      register,
      login,
      logout,
    }),
    [user, register, login, logout],
  );
}
