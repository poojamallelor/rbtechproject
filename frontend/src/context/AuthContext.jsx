import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// ── AuthProvider ───────────────────────────────────────────────────────────────
// Wraps the whole app; listens to Supabase auth state changes in real time.
export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);   // true while we check session

  useEffect(() => {
    // 1️⃣  Check for an existing session on first load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2️⃣  Subscribe to future auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth helpers ─────────────────────────────────────────────────────────────
  const signInWithEmail = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUpWithEmail = (email, password) =>
    supabase.auth.signUp({ email, password });

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email);

  const logout = () => supabase.auth.signOut();

  // Legacy compat helpers used by other parts of the app
  const isLoggedIn = !!user;
  const login = () => {};   // no-op; login now goes through Supabase

  // Show a full-screen spinner until we know if user is logged in
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05050B]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading session…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isLoggedIn,
        login,
        logout,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
