'use client'

import './annonsanalys.css'
import { useState } from 'react'
import type { AdsAnalysisResult } from './ai/compareAds'

import AdInputPanel from './components/AdInputPanel'
import QuickAnalysisCards from './components/QuickAnalysisCards'
import RecommendationSection from './components/RecommendationSection'
import ApplicationAdviceSection from './components/ApplicationAdviceSection'
import DeepAnalysisSection from './components/DeepAnalysisSection'
import ComparisonSections from './components/ComparisonSections'
import PreferenceModal from './components/PreferenceModal'

type ErrorResponse = {
  error?: string
}

/** Normalisera ett annons-ID till en bokstav: "A", "B", "C"... */
function normalizeAdId(id: string): string {
  if (!id) return ''
  const trimmed = id.trim()
  if (trimmed.length === 1) return trimmed.toUpperCase()

  const firstLetterMatch = trimmed.match(/[A-Za-zÅÄÖ]/)
  if (firstLetterMatch) {
    return firstLetterMatch[0].toUpperCase()
  }

  return trimmed.toUpperCase()
}

/** Räkna röster per annons baserat på preferensfrågor */
function getPreferenceScores(
  res: AdsAnalysisResult | null,
  answers: Record<string, string>
) {
  if (!res) return {}

  const scores: Record<string, number> = {}

  // initiera med 0 för alla annonser
  for (const ad of res.ads) {
    const norm = normalizeAdId(ad.id)
    if (!(norm in scores)) {
      scores[norm] = 0
    }
  }

  // räkna röster
  for (const answeredAdId of Object.values(answers)) {
    const normAnswer = normalizeAdId(answeredAdId)
    if (!(normAnswer in scores)) {
      scores[normAnswer] = 0
    }
    scores[normAnswer] += 1
  }

  return scores
}

type TopPreference = {
  adId: string
  label: string
  score: number
  totalAnswers: number
}

/** Hitta vinnaren baserat på svaren – men bara om ALLA frågor är besvarade */
function getTopAdFromPreferences(
  res: AdsAnalysisResult | null,
  answers: Record<string, string>
): TopPreference | null {
  if (!res) return null

  const totalQuestions = res.questions?.length ?? 0
  const totalAnswers = Object.values(answers).length

  if (totalQuestions === 0 || totalAnswers === 0) return null
  if (totalAnswers !== totalQuestions) return null

  const scores = getPreferenceScores(res, answers)
  const entries = Object.entries(scores).filter(([, value]) => value > 0)
  if (entries.length === 0) return null

  const [topNormId, topScore] = entries.reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    entries[0]
  )

  const adMeta = res.ads.find(
    (ad) => normalizeAdId(ad.id) === topNormId
  )

  if (!adMeta) {
    return {
      adId: topNormId,
      label: `Annons ${topNormId}`,
      score: topScore,
      totalAnswers,
    }
  }

  return {
    adId: adMeta.id,
    label: adMeta.label,
    score: topScore,
    totalAnswers,
  }
}

export default function AnnonsanalysPage() {
  const [ads, setAds] = useState<string[]>(['', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AdsAnalysisResult | null>(null)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false)

  const canAnalyze =
    ads[0]?.trim().length > 0 && ads[1]?.trim().length > 0

  const handleAdChange = (index: number, value: string) => {
    setAds((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  const handleAddAd = () => {
    setAds((prev) => [...prev, ''])
  }

  const handleAnalyze = async () => {
    if (!canAnalyze || loading) return

    setLoading(true)
    setError(null)
    setResult(null)
    setAnswers({})
    setIsPrefModalOpen(false)

    try {
      const res = await fetch('/annonsanalys/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads }),
      })

      const text = await res.text()
      let parsed: unknown = null

      if (text) {
        try {
          parsed = JSON.parse(text)
        } catch (parseErr) {
          console.error(
            'Kunde inte parsa svar från /annonsanalys/compare:',
            parseErr,
            text
          )
        }
      }

      if (!res.ok) {
        const data = (parsed ?? {}) as ErrorResponse
        const msg = data.error ?? 'Något gick fel vid analysen.'
        throw new Error(msg)
      }

      const data = parsed as AdsAnalysisResult

      console.log('AI raw result:', data)
      console.log('ads:', (data as AdsAnalysisResult | null)?.ads)
      console.log('sections:', (data as AdsAnalysisResult | null)?.sections)
      console.log('questions:', (data as AdsAnalysisResult | null)?.questions)

      setResult(data)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Okänt fel.')
      } else {
        setError(String(err) || 'Okänt fel.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, adId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: adId,
    }))
  }

  const hasQuestions =
    !!result &&
    Array.isArray(result.questions) &&
    result.questions.length > 0

  const totalQuestions = result?.questions?.length ?? 0
  const totalAnswers = Object.values(answers).length
  const allQuestionsAnswered =
    hasQuestions && totalAnswers > 0 && totalAnswers === totalQuestions

  const prefScores = result ? getPreferenceScores(result, answers) : {}

  const topPreference = getTopAdFromPreferences(result, answers)

  const recommendedAd =
    topPreference && result
      ? result.ads.find(
          (ad) =>
            normalizeAdId(ad.id) === normalizeAdId(topPreference.adId)
        )
      : null

  const recommendedLabel =
    recommendedAd?.label ?? topPreference?.label ?? null

  const shouldShowRecommendationCard =
    Boolean(topPreference) &&
    allQuestionsAnswered &&
    Boolean(recommendedLabel)

  return (
    <>
      <main className="app">
        {/* HEADER */}
        <div className="workspace-header">
          <h1 className="workspace-title">Annonsanalys</h1>
          <div className="workspace-actions">
            <button
              id="help-btn"
              className="btn secondary"
              type="button"
              title="Visa instruktioner"
            >
              <span className="btn-icon" aria-hidden="true">
                ?
              </span>
              Hjälp
            </button>
            <button
              id="login-btn"
              className="btn secondary"
              type="button"
              title="Logga in via ditt Go Monday-konto"
            >
              <span className="btn-icon" aria-hidden="true">
                {/* ikon senare */}
              </span>
              Logga in
            </button>
          </div>
        </div>

        <div id="tagline">
          <h2>
            Vad säger jobbannonserna egentligen och vilket jobb bör du söka?
          </h2>
        </div>

        {/* HUVUDLAYOUT: två kolumner */}
        <section className="workspace-grid two-col workspace-section">
          {/* VÄNSTER: input */}
          <AdInputPanel
            ads={ads}
            canAnalyze={canAnalyze}
            loading={loading}
            error={error}
            onChangeAd={handleAdChange}
            onAddAd={handleAddAd}
            onAnalyze={handleAnalyze}
          />

          {/* HÖGER: snabbanalys */}
          <div className="section-result">
            <h2 className="section-heading">Snabbanalys</h2>

            <QuickAnalysisCards
              result={result}
              prefScores={prefScores}
              allQuestionsAnswered={allQuestionsAnswered}
              hasQuestions={hasQuestions}
              onOpenPreferences={() => setIsPrefModalOpen(true)}
              normalizeAdId={normalizeAdId}
            />
          </div>
        </section>

        {/* 1. SLUTSATS & REKOMMENDATION (frågebaserad) */}
        <RecommendationSection
          show={shouldShowRecommendationCard}
          topPreference={topPreference}
          recommendedLabel={recommendedLabel}
        />

        {/* 2. INFÖR DIN ANSÖKAN */}
        {result && (
          <ApplicationAdviceSection
            result={result}
            normalizeAdId={normalizeAdId}
          />
        )}

        {/* 3. FÖRDJUPAD ANALYS PER TJÄNST */}
        <DeepAnalysisSection
          result={result}
          normalizeAdId={normalizeAdId}
        />

        {/* 4. ANNONSJÄMFÖRELSE */}
        <ComparisonSections
          result={result}
          normalizeAdId={normalizeAdId}
        />
      </main>

      {/* Modal med frivilliga preferensfrågor */}
      <PreferenceModal
        open={!!result && hasQuestions && isPrefModalOpen}
        onClose={() => setIsPrefModalOpen(false)}
        questions={result?.questions ?? []}
        answers={answers}
        onAnswerChange={handleAnswerChange}
      />

      <div>
        <footer>
          <p>
            Annonsanalysen använder AI och kan begå misstag. Kontrollera viktig
            information.
          </p>
        </footer>
      </div>
    </>
  )
}
