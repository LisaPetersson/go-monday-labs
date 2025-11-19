// app/annonsanalys/page.tsx
'use client'

import './annonsanalys.css'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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

/** Rad från ad_rawdata när vi hämtar en sparad analys */
type AnalysisRowFromDb = {
  id: string
  raw_ads: string[] | null
  result: AdsAnalysisResult
}

/** Rad från tabellen med sparade preferenssvar */
type PreferenceAnswerRow = {
  question_id: string
  question_text: string
  option_id: string
  option_label: string
  ad_id: string
  analysis_id: string | null
  created_at: string
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

  // initiera med 0
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

type AnswerReason = {
  questionId: string
  questionText: string
  optionLabel: string
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
  const [userId, setUserId] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [hasSavedAnswers, setHasSavedAnswers] = useState(false)

  const searchParams = useSearchParams()
  const analysisIdFromUrl = searchParams.get('analysisId')

  // Hämta inloggad användare
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Kunde inte hämta användare i AnnonsanalysPage:', error)
        return
      }
      setUserId(data.user?.id ?? null)
    }

    loadUser()
  }, [])

  // Om vi har analysisId i URL:en: ladda sparad analys + sparade svar
  useEffect(() => {
    const loadSavedAnalysis = async () => {
      if (!analysisIdFromUrl || !userId) return

      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('ad_rawdata')
        .select('id, raw_ads, result')
        .eq('id', analysisIdFromUrl)
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Kunde inte hämta sparad analys:', error)
        setError('Kunde inte hämta den sparade analysen.')
        setLoading(false)
        return
      }

      const row = data as AnalysisRowFromDb

      setAnalysisId(row.id)

      if (row.raw_ads && Array.isArray(row.raw_ads)) {
        setAds(row.raw_ads)
      }
      setResult(row.result)
      setIsPrefModalOpen(false)

      // Hämta sparade preferenssvar till den här analysen
      const { data: answersData, error: answersError } = await supabase
        .from('ad_preference_answers')
        .select('question_id, ad_id')
        .eq('analysis_id', row.id)
        .eq('user_id', userId)

      if (answersError) {
        console.error('Kunde inte hämta sparade preferenssvar:', answersError)
        setAnswers({})
        setHasSavedAnswers(false)
      } else {
        const restored: Record<string, string> = {}
        ;(answersData as PreferenceAnswerRow[] | null)?.forEach((r) => {
          restored[r.question_id] = r.ad_id
        })
        setAnswers(restored)
        setHasSavedAnswers(Object.keys(restored).length > 0)
      }

      setLoading(false)
    }

    void loadSavedAnalysis()
  }, [analysisIdFromUrl, userId])

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
    setHasSavedAnswers(false)
    setAnalysisId(null)

    try {
      const res = await fetch('/annonsanalys/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads, userId }),
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
      setResult(data)

      // Hämta senaste analys-id för den här användaren (den vi just sparade i /compare)
      if (userId) {
        const { data: latestRow, error: latestErr } = await supabase
          .from('ad_rawdata')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!latestErr && latestRow) {
          setAnalysisId((latestRow as { id: string }).id)
        }
      }
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
    setHasSavedAnswers(false) // ny ändring → flagga att vi behöver spara igen
  }

  const hasQuestions =
    !!result &&
    Array.isArray(result?.questions) &&
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

  const answerReasons: AnswerReason[] = []

  if (result && topPreference && Array.isArray(result.questions)) {
    const topNormId = normalizeAdId(topPreference.adId)

    for (const q of result.questions) {
      const chosenAdId = answers[q.id]
      if (!chosenAdId) continue

      const chosenOption = q.options.find(
        (opt) => normalizeAdId(opt.adId) === normalizeAdId(chosenAdId)
      )
      if (!chosenOption) continue

      if (normalizeAdId(chosenOption.adId) !== topNormId) continue

      answerReasons.push({
        questionId: q.id,
        questionText: q.text,
        optionLabel: chosenOption.label,
      })
    }
  }

  const aiReason = result?.comparison?.reason ?? null

  const shouldShowRecommendationCard =
    Boolean(topPreference) &&
    allQuestionsAnswered &&
    Boolean(recommendedLabel)

  /**
   * Spara preferenssvar när:
   * - vi har userId + analysisId + result
   * - alla frågor är besvarade
   * - vi inte redan har sparat den aktuella omgången
   */
  useEffect(() => {
    const savePreferenceAnswers = async () => {
      if (!userId || !analysisId || !result) return
      if (!allQuestionsAnswered) {
        setHasSavedAnswers(false)
        return
      }
      if (hasSavedAnswers) return

      const rows = Object.entries(answers).flatMap(
        ([questionId, adId]) => {
          const question = result.questions?.find(
            (q) => q.id === questionId
          )
          if (!question) return []

          const option = question.options.find(
            (opt) =>
              normalizeAdId(opt.adId) === normalizeAdId(adId)
          )
          if (!option) return []

          return [
            {
              user_id: userId,
              analysis_id: analysisId,
              question_id: question.id,
              question_text: question.text,
              option_id: option.id,
              option_label: option.label,
              ad_id: option.adId,
            },
          ]
        }
      )

      // Rensa gamla svar för just denna analys + användare
      const { error: delError } = await supabase
        .from('ad_preference_answers')
        .delete()
        .eq('user_id', userId)
        .eq('analysis_id', analysisId)

      if (delError) {
        console.error(
          'Kunde inte radera gamla preferenssvar:',
          delError
        )
      }

      if (rows.length > 0) {
        const { error: insError } = await supabase
          .from('ad_preference_answers')
          .insert(rows)

        if (insError) {
          console.error(
            'Kunde inte spara preferenssvar:',
            insError
          )
          return
        }
      }

      setHasSavedAnswers(true)
    }

    void savePreferenceAnswers()
  }, [
    userId,
    analysisId,
    result,
    allQuestionsAnswered,
    answers,
    hasSavedAnswers,
  ])

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
          </div>
        </div>

        <div id="tagline">
          <h2>
            Vad säger jobbannonserna egentligen och vilket jobb bör
            du söka?
          </h2>
        </div>

        {/* HUVUDLAYOUT: två kolumner */}
        <section className="workspace-grid two-col workspace-section">
          <AdInputPanel
            ads={ads}
            canAnalyze={canAnalyze}
            loading={loading}
            error={error}
            onChangeAd={handleAdChange}
            onAddAd={handleAddAd}
            onAnalyze={handleAnalyze}
          />

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

        <RecommendationSection
          show={shouldShowRecommendationCard}
          topPreference={topPreference}
          recommendedLabel={recommendedLabel}
          answerReasons={answerReasons}
          aiReason={aiReason}
        />

        {result && (
          <ApplicationAdviceSection
            result={result}
            normalizeAdId={normalizeAdId}
          />
        )}

        <DeepAnalysisSection
          result={result}
          normalizeAdId={normalizeAdId}
        />

        <ComparisonSections
          result={result}
          normalizeAdId={normalizeAdId}
        />
      </main>

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
            Annonsanalysen använder AI och kan begå misstag.
            Kontrollera viktig information.
          </p>
        </footer>
      </div>
    </>
  )
}
