// app/annonsanalys/components/RecommendationSection.tsx
// RecommendationSection.tsx – bara slutsatsen och rekommendationen
import React from 'react'

type TopPreference = {
  adId: string
  label: string
  score: number
  totalAnswers: number
}

type Props = {
  show: boolean
  topPreference: TopPreference | null
  recommendedLabel: string | null
}

const RecommendationSection: React.FC<Props> = ({
  show,
  topPreference,
  recommendedLabel,
}) => {
  if (!show || !topPreference || !recommendedLabel) return null

  return (
    <section className="workspace-section">
      <h2 className="section-heading">Slutsats & rekommendation</h2>
       <p><i>Pro-funktion</i></p>

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
          <div className="analysis-subsection">
            <h5>Rekommendation</h5>
            <p>
              Baserat på dina svar verkar{' '}
              <strong>{recommendedLabel}</strong> passa dig bäst. Du
              valde alternativ som pekar mot{' '}
              <strong>{recommendedLabel}</strong> i{' '}
              <strong>
                {topPreference.score} av {topPreference.totalAnswers}
              </strong>{' '}
              frågor.
            </p>
          </div>
          <div className="analysis-subsection">
            <h5>Motivering</h5>
            <p>
              Dina svar visar att du föredrar arbetsstil, miljö och
              utveckling som bättre matchar{' '}
              <strong>{recommendedLabel}</strong>.
            </p>
          </div>
        </div>
      </article>
    </section>
  )
}

export default RecommendationSection
