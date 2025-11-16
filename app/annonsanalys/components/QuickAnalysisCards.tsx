// app/annonsanalys/components/QuickAnalysisCards.tsx
// QuickAnalysisCards.tsx – visar korten per annons + knappen för preferenser
import React from 'react'
import type { AdsAnalysisResult as BaseAdsAnalysisResult } from '../ai/compareAds'

type AdsAnalysisResult = BaseAdsAnalysisResult

type Props = {
  result: AdsAnalysisResult | null
  prefScores: Record<string, number>
  allQuestionsAnswered: boolean
  hasQuestions: boolean
  onOpenPreferences: () => void
  normalizeAdId: (id: string) => string
}

const QuickAnalysisCards: React.FC<Props> = ({
  result,
  prefScores,
  allQuestionsAnswered,
  hasQuestions,
  onOpenPreferences,
  normalizeAdId,
}) => {
  if (!result) {
    return (
      <div className="analysis-card">
        <div className="analysis-card-header">
          <h4>
            <span className="icon" aria-hidden="true">
              💡
            </span>
            <span>Analysen visas här när du har kört en jämförelse.</span>
          </h4>
        </div>
        <div className="analysis-card-body">
          <p className="empty-state">
            Klistra in minst två annonser och klicka på{' '}
            <strong>Analysera &amp; jämför</strong>.
          </p>
        </div>
      </div>
    )
  }

  const totalAnswers = Object.entries(prefScores).reduce(
    (sum, [, value]) => sum + value,
    0
  )

  return (
    <>
      <div className="cards-flex">
        {result.ads.map((ad) => {
          const normId = normalizeAdId(ad.id)

          let matchContent: React.ReactNode = (
            <span
              className="match-locked"
              title="Pro-funktion. Uppgradera ditt konto"
            >
              🔒 Matchning ej genomförd
            </span>
          )

          if (allQuestionsAnswered && totalAnswers > 0) {
            const votes = prefScores[normId] ?? 0
            const percentage = Math.round((votes / totalAnswers) * 100)
            matchContent = <>Matchning: {percentage} / 100</>
          }

          return (
            <article key={ad.id} className="analysis-card">
              <div className="analysis-card-header is-expanded">
                <h4>
                  <span className="icon" aria-hidden="true">
                    {normId}
                  </span>
                  <span>{ad.label} – analys</span>
                  <span className="header-summary">{matchContent}</span>
                </h4>
              </div>
              <div className="analysis-card-body">
                <p>{ad.summary}</p>
              </div>
            </article>
          )
        })}
      </div>

      {hasQuestions && (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn secondary"
            onClick={onOpenPreferences}
            title="Pro-funktion. Uppgradera ditt konto"
          >
            <span className="lock-icon" aria-hidden="true">
              🔒
            </span>
            <span>Vilken roll matchar mig bäst?</span>
          </button>
        </div>
      )}
    </>
  )
}

export default QuickAnalysisCards
