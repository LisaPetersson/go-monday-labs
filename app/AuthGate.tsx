// app/AuthGate.tsx
'use client'

import {
  useEffect,
  useState,
  type ReactNode,
  FormEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { AdsAnalysisResult } from '@/app/annonsanalys/ai/compareAds'

type AuthGateProps = {
  children: ReactNode
}

type HistoryRow = {
  id: string
  created_at: string
  recommended_label: string | null
  result: AdsAnalysisResult | null
}

type InsightRow = {
  id: string
  analysis_id: string | null
  question_id: string
  question_text: string
  option_label: string
  ad_id: string
  created_at: string
}

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setShowMyPage(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Globalt: gör alla cards/widgets med header fällbara
  useEffect(() => {
    const handleClick = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      // Hitta närmaste header vi bryr oss om
      const header = target.closest(
        '.analysis-card-header, .widget-header'
      ) as HTMLElement | null

      if (!header) return

      // Hitta själva kortet (article.analysis-card eller div.widget)
      const card = header.closest(
        '.analysis-card, .widget'
      ) as HTMLElement | null

      if (!card) return

      // Möjlighet att opt-out om vi skulle vilja i framtiden:
      if (header.dataset.nocollapse === 'true') return

      // Toggle kollaps
      card.classList.toggle('is-collapsed')

      const isCollapsed = card.classList.contains('is-collapsed')
      header.setAttribute('aria-expanded', (!isCollapsed).toString())
    }

    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('click', handleClick)
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

      {showMyPage ? (
        <MyPage
          user={user}
          onOpenAnalysis={() => setShowMyPage(false)}
        />
      ) : (
        children
      )}
    </>
  )
}

/**
 * "Min sida":
 * - Tidigare analyser (med alla annons-labels)
 * - Personliga insikter från preferensfrågorna
 */
function MyPage({
  user,
  onOpenAnalysis,
}: {
  user: User
  onOpenAnalysis: () => void
}) {
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [insights, setInsights] = useState<InsightRow[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)

  const router = useRouter()

  // Tidigare analyser
  useEffect(() => {
    const loadHistory = async () => {
      const { data, error } = await supabase
        .from('ad_rawdata')
        .select('id, created_at, recommended_label, result')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Kunde inte hämta historik på Min sida:', error)
      } else {
        setHistory((data as HistoryRow[]) ?? [])
      }

      setHistoryLoading(false)
    }

    loadHistory()
  }, [user.id])

  // Personliga insikter (preferenssvar)
  useEffect(() => {
    const loadInsights = async () => {
      const { data, error } = await supabase
        .from('ad_preference_answers')
        .select(
          'id, analysis_id, question_id, question_text, option_label, ad_id, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Kunde inte hämta personliga insikter:', error)
        setInsights([])
        setInsightsLoading(false)
        return
      }

      const rows = (data as InsightRow[]) ?? []

      // Behåll senaste svar per fråga
      const byQuestion: Record<string, InsightRow> = {}
      for (const row of rows) {
        if (!byQuestion[row.question_id]) {
          byQuestion[row.question_id] = row
        }
      }

      setInsights(Object.values(byQuestion))
      setInsightsLoading(false)
    }

    loadInsights()
  }, [user.id])

  const handleOpenAnalysis = (id: string) => {
    onOpenAnalysis()
    router.push(`/annonsanalys?analysisId=${id}`)
  }

  // Gruppera insikter per annons-id (A/B/C ...)
  const insightsByAd = insights.reduce(
    (acc, row) => {
      const key = (row.ad_id || '').trim().toUpperCase() || '?'
      if (!acc[key]) acc[key] = []
      acc[key].push(row)
      return acc
    },
    {} as Record<string, InsightRow[]>
  )

  const totalInsights = insights.length

  return (
    <main className="app mypage-app">
      <div className="workspace-header">
        <h1 className="workspace-title">Min sida</h1>
      </div>

      {/* TIDIGARE ANALYSER */}
      <section className="workspace-section">
        <h2 className="section-heading">Tidigare analyser</h2>

        {historyLoading && <p>Laddar dina tidigare analyser...</p>}

        {!historyLoading && history.length === 0 && (
          <p>Du har inte gjort några analyser ännu.</p>
        )}

        {!historyLoading && history.length > 0 && (
          <ul className="history-list">
            {history.map((row) => (
              <li key={row.id} className="history-item">
                <div className="history-row-main">
                  <div className="history-row-text">
                    <span className="history-date">
                      {new Date(row.created_at).toLocaleString('sv-SE')}
                    </span>
                    {' – '}
                    <span className="history-label">
                      {row.recommended_label ??
                        'Ingen tydlig rekommendation'}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="history-open-btn"
                    onClick={() => handleOpenAnalysis(row.id)}
                  >
                    Öppna
                  </button>
                </div>

                {row.result?.ads && row.result.ads.length > 0 && (
                  <div className="history-ad-labels">
                    {row.result.ads.map((ad) => (
                      <span
                        key={ad.id}
                        className="history-ad-label"
                      >
                        {ad.label}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PERSONLIGA INSIKTER */}
      <section className="workspace-section insights-section">
        <div className="insights-header-row">
          <h2 className="section-heading">Personliga insikter</h2>
          {totalInsights > 0 && (
            <p className="insights-meta">
              Baserat på dina senaste {totalInsights} svar i
              preferensfrågorna.
            </p>
          )}
        </div>

        {insightsLoading && <p>Laddar dina insikter...</p>}

        {!insightsLoading && totalInsights === 0 && (
          <p>
            Här kommer dina personliga insikter att visas – svara på
            preferensfrågorna i annonsanalysen för att bygga upp din
            profil.
          </p>
        )}

        {!insightsLoading && totalInsights > 0 && (
          <div className="insights-grid">
            {Object.entries(insightsByAd).map(([adId, items]) => (
              <article
                key={adId}
                className="analysis-card insights-card"
              >
                <header className="analysis-card-header insights-card-header">
                  <div>
                    <span
                      className={`insight-chip insight-chip-${adId}`}
                    >
                      Annons {adId}
                    </span>
                    <p className="insight-card-subtitle">
                      {items.length} svar som pekar mot den här typen av
                      roll.
                    </p>
                  </div>
                </header>

                <div className="analysis-card-body insights-card-body">
                  <ul className="insights-list">
                    {items.map((row) => (
                      <li key={row.id} className="insight-item">
                        <p className="insight-question">
                          {row.question_text}
                        </p>
                        <p className="insight-answer">
                          {row.option_label}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
