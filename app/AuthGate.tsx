// app/AuthGate.tsx

'use client'

import {
  useEffect,
  useState,
  type ReactNode,
  FormEvent,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient' // din klient med publishable key

type AuthGateProps = {
  children: ReactNode
}

type HistoryRow = {
  id: string
  created_at: string
  recommended_label: string | null
}

type PreferenceAnswerRow = {
  id: string
  created_at: string
  question_text: string
  option_label: string
}

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Visa / dölj "Min sida"
  const [showMyPage, setShowMyPage] = useState(false)

  // Hämta ev. befintlig session
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Kunde inte hämta användare:', error)
      }
      setUser(data?.user ?? null)
      setLoading(false)
    }

    loadUser()

    // Lyssna på login/logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      // När man loggar ut → lämna Min sida-läget
      if (!session?.user) {
        setShowMyPage(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Inloggning misslyckades:', error)
      setError(error.message)
      return
    }

    setUser(data.user)
    setEmail('')
    setPassword('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setShowMyPage(false)
  }

  // 1) Laddar auth-state
  if (loading) {
    return (
      <main className="login-page">
        <div className="login-layout">
          <div className="login-header">
            <h1 className="login-app-title">Annonsanalys</h1>
            <p className="login-app-tagline">
              Vi hjälper dig att förstå vad jobbannonserna egentligen säger –
              och vilket jobb som passar dig bäst.
            </p>
          </div>

          <div className="login-card">
            <p className="login-loading">Laddar...</p>
          </div>
        </div>
      </main>
    )
  }

  // 2) Inte inloggad → visa login
  if (!user) {
    return (
      <main className="login-page">
        <div className="login-layout">
          <div className="login-header">
            <h1 className="login-app-title">Annonsanalys</h1>
            <p className="login-app-tagline">
              Logga in med ditt konto för att analysera och jämföra
              jobbannonser.
            </p>
          </div>

          <section className="login-card">
            <h2 className="login-title">Logga in</h2>
            <p className="login-subtitle">
              Använd dina inloggningsuppgifter från Go Monday.
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
    )
  }

  // 3) Inloggad → toppbar + antingen Min sida eller appen
  return (
    <>
      <header className="login-topbar">
        <div className="login-topbar-inner">
          <span className="login-user-email">{user.email}</span>

          {/* Knapp för Min sida – ligger före Logga ut */}
          <button
            type="button"
            className="login-logout-btn"
            onClick={() => setShowMyPage((prev) => !prev)}
          >
            {showMyPage ? 'Tillbaka till annonsanalysen' : 'Min sida'}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="login-logout-btn"
          >
            Logga ut
          </button>
        </div>
      </header>

      {showMyPage ? <MyPage user={user} /> : children}
    </>
  )
}

/**
 * "Min sida":
 * - Tidigare analyser (ad_rawdata)
 * - Personliga insikter (ad_preference_answers)
 */
function MyPage({ user }: { user: User }) {
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [answers, setAnswers] = useState<PreferenceAnswerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      // 1) Tidigare analyser
      const { data: histData, error: histError } = await supabase
        .from('ad_rawdata')
        .select('id, created_at, recommended_label')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (histError) {
        console.error('Kunde inte hämta historik på Min sida:', histError)
      } else {
        setHistory((histData as HistoryRow[]) ?? [])
      }

      // 2) Personliga insikter – råsvar från preferensfrågor
      const { data: ansData, error: ansError } = await supabase
        .from('ad_preference_answers')
        .select('id, created_at, question_text, option_label')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (ansError) {
        console.error('Kunde inte hämta preferenssvar på Min sida:', ansError)
      } else {
        setAnswers(
          (ansData as PreferenceAnswerRow[]) ?? []
        )
      }

      setLoading(false)
    }

    loadData()
  }, [user.id])

  return (
    <main className="app mypage-app">
      <div className="workspace-header">
        <h1 className="workspace-title">Min sida</h1>
      </div>

      <section className="workspace-section">
        <h2 className="section-heading">Tidigare analyser</h2>

        {loading && <p>Laddar dina tidigare analyser...</p>}

        {!loading && history.length === 0 && (
          <p>Du har inte gjort några analyser ännu.</p>
        )}

        {!loading && history.length > 0 && (
          <ul className="history-list">
            {history.map((row) => (
              <li key={row.id} className="history-item">
                <span className="history-date">
                  {new Date(row.created_at).toLocaleString('sv-SE')}
                </span>
                {' – '}
                <span className="history-label">
                  {row.recommended_label ?? 'Ingen tydlig rekommendation'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="workspace-section">
        <h2 className="section-heading">Personliga insikter</h2>

        {loading && <p>Laddar dina sparade svar...</p>}

        {!loading && answers.length === 0 && (
          <p>
            När du har svarat på preferensfrågorna i annonsanalysen kommer dina
            svar att visas här.
          </p>
        )}

        {!loading && answers.length > 0 && (
          <ul className="history-list">
            {answers.map((row) => (
              <li key={row.id} className="history-item">
                <div>
                  <div className="history-date">
                    {new Date(row.created_at).toLocaleString('sv-SE')}
                  </div>
                  <div className="history-label">
                    <strong>Fråga:</strong> {row.question_text}
                  </div>
                  <div>
                    <strong>Ditt svar:</strong> {row.option_label}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
