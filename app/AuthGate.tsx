'use client';

import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

type AuthGateProps = {
  children: ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Hämta ev. befintlig session
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Kunde inte hämta användare:', error);
      }
      setUser(data?.user ?? null);
      setLoading(false);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Inloggning misslyckades:', error);
      setError(error.message);
      return;
    }

    setUser(data.user);
    setEmail('');
    setPassword('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // 1) Laddar auth-state
  if (loading) {
    return (
      <main className="login-page">
        <div className="login-layout">
          <p className="login-loading">Laddar...</p>
        </div>
      </main>
    );
  }

  // 2) Inte inloggad → visa login
  if (!user) {
    return (
      <main className="login-page">
        <div className="login-layout">
          <header className="login-header">
            <h1 className="login-app-title">Go Monday Labs</h1>
            <p className="login-app-tagline">
              Utforska experimentella verktyg för smartare jobbsök – logga in
              för att använda annonsanalysen.
            </p>
          </header>

          <section className="login-card">
            <h2 className="login-title">Logga in</h2>
            <p className="login-subtitle">
              Använd ditt befintliga konto för tjänsten.
            </p>

            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-field">
                <label className="field-label" htmlFor="email">
                  E-post
                </label>
                <input
                  id="email"
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="login-field">
                <label className="field-label" htmlFor="password">
                  Lösenord
                </label>
                <input
                  id="password"
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && <p className="login-error">{error}</p>}

              <div className="login-actions">
                <button type="submit" className="login-primary-btn">
                  Logga in
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }

  // 3) Inloggad → topbar + resten av appen
  return (
    <>
      <header className="login-topbar">
        <div className="login-topbar-inner">
          <span className="login-user-email">{user.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="login-logout-btn"
          >
            Logga ut
          </button>
        </div>
      </header>

      {children}
    </>
  );
}
