// app/annonsanalys/components/RecommendationSection.tsx
// RecommendationSection.tsx – slutsats & rekommendation
import React from 'react'

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

type Props = {
  show: boolean
  topPreference: TopPreference | null
  recommendedLabel: string | null
  /** Vad användarens svar visar att hen föredrar */
  answerReasons: AnswerReason[]
  /** Motivering från AI (result.comparison.reason) */
  aiReason?: string | null
}

const RecommendationSection: React.FC<Props> = ({
  show,
  topPreference,
  recommendedLabel,
  answerReasons,
  aiReason,
}) => {
  if (!show || !topPreference || !recommendedLabel) return null

  const hasAnswerReasons = answerReasons && answerReasons.length > 0
  const reasonsToShow = hasAnswerReasons ? answerReasons.slice(0, 3) : []

  // Rensa upp AI-texten och filtrera bort vår tråkiga fallback-mening
  const rawAiReason = (aiReason ?? '').trim()
  const isGenericFallback =
    /framstår den rekommenderade tjänsten som den mest intressanta möjligheten i nuläget/i.test(
      rawAiReason
    )

  const hasUsefulAiReason =
    rawAiReason.length > 0 && !isGenericFallback

  return (
    <section className="workspace-section">
      <h2 className="section-heading">Slutsats &amp; rekommendation</h2>
      <p>
        <i>Pro-funktion</i>
      </p>

      <article className="analysis-card is-warning">
        <div className="analysis-card-header is-expanded">
          <h4>
            <span className="icon" aria-hidden="true">
              ✅
            </span>
            <span>Rekommenderad tjänst</span>
          </h4>
        </div>

        <div className="analysis-card-body">
          {/* DEL 1 – tydlig slutsats baserad på antal svar */}
          <div className="analysis-subsection">
            <h5>Rekommendation</h5>
            <p>
              Baserat på dina svar verkar{' '}
              {recommendedLabel} passa dig bäst. Du valde
              alternativ som pekar mot {recommendedLabel} i{' '}
              
                {topPreference.score} av {topPreference.totalAnswers}
              {' '}
              frågor.
            </p>
          </div>

          {/* DEL 2 – motivering: dina preferenser + ev. AI-tolkning */}
          <div className="analysis-subsection">
            <h5>Motivering</h5>

            {hasAnswerReasons ? (
              <>
                <p>
                  Rekommendationen bygger i första hand på hur du svarade i
                  preferensfrågorna. Dina svar visar att du särskilt
                  föredrar:
                </p>
                <ul>
                  {reasonsToShow.map((item) => (
                    <li key={item.questionId}>{item.optionLabel}</li>
                  ))}
                </ul>
                {answerReasons.length > reasonsToShow.length && (
                  <p className="empty-state">
                    Fler av dina svar pekar åt samma håll, vilket stärker
                    matchningen mot {recommendedLabel}.
                  </p>
                )}

                {hasUsefulAiReason && (
                  <p className="ai-summary">
                    AI:s tolkning av annonserna:{' '}
                    {rawAiReason}
                  </p>
                )}
              </>
            ) : (
              <p>
                Dina svar visar att du föredrar arbetsstil, miljö och
                utveckling som bättre matchar{' '}
                {recommendedLabel}.
              </p>
            )}
          </div>
        </div>
      </article>
    </section>
  )
}

export default RecommendationSection
