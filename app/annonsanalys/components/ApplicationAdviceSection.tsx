// app/annonsanalys/components/ApplicationAdviceSection.tsx
import type { AdsAnalysisResult } from '../ai/compareAds'

type Props = {
  result: AdsAnalysisResult | null
  normalizeAdId: (id: string) => string
}

export default function ApplicationAdviceSection({ result, normalizeAdId }: Props) {
  if (!result || !result.applicationAdvice) return null

  const { applicationAdvice } = result
  const perAd = applicationAdvice.perAd ?? []
  const overallTips = applicationAdvice.overallTips ?? []

  // Sortera per tjänst i samma ordning som ads[]
  const perAdSorted = result.ads
    .map((ad) => {
      const match = perAd.find(
        (item) => normalizeAdId(item.adId) === normalizeAdId(ad.id)
      )
      if (!match) return null
      return {
        ad,
        advice: match,
      }
    })
    .filter((x): x is { ad: AdsAnalysisResult['ads'][number]; advice: (typeof perAd)[number] } => x !== null)

  // Om vi inte har något vettigt innehåll – visa inget kort alls
  const hasAnyContent =
    perAdSorted.length > 0 ||
    (overallTips && overallTips.length > 0)

  if (!hasAnyContent) return null

 const labelForAd = (ad: AdsAnalysisResult['ads'][number]) => {
  const label = ad.label?.trim()
  if (label) return label

  const title = ad.title?.trim()
  const company = ad.company?.trim()

  if (title && company) return `${title} – ${company}`
  if (title) return title
  if (company) return company

  return 'Okänd roll'
}

  return (
    <section className="workspace-section">
      <h2 className="section-heading">Inför din ansökan</h2>
    <p><i>Ev. pro-funktion som endast syns efter matchning, kanske då bara annonsen man matchat mot</i></p>
      <article className="analysis-card dynamic-section-card">
        <div className="analysis-card-header is-expanded">
          <h4>
            <span className="icon" aria-hidden="true">
              ✍️
            </span>
            <span>Vad du bör lyfta i din ansökan</span>
          </h4>
        </div>

        <div className="analysis-card-body">
          {/* Två kolumner: en per tjänst */}
          {perAdSorted.length > 0 && (
            <div className="dynamic-section-grid">
              {perAdSorted.map(({ ad, advice }) => (
                <div
                  key={normalizeAdId(ad.id)}
                  className="analysis-subsection"
                >
                  <h5>{labelForAd(ad)}</h5>

                  {advice.themes && advice.themes.length > 0 && (
                    <div className="analysis-subsection">
                      <h5>Teman att lyfta</h5>
                      <ul>
                        {advice.themes.map((item, i) => (
                          <li key={`theme-${normalizeAdId(ad.id)}-${i}`}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {advice.keywords && advice.keywords.length > 0 && (
                    <div className="analysis-subsection">
                      <h5>Nyckelord &amp; begrepp</h5>
                      <ul>
                        {advice.keywords.map((item, i) => (
                          <li key={`kw-${normalizeAdId(ad.id)}-${i}`}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {advice.atsTips && advice.atsTips.length > 0 && (
                    <div className="analysis-subsection">
                      <h5>ATS-tips för den här rollen</h5>
                      <ul>
                        {advice.atsTips.map((item, i) => (
                          <li key={`ats-${normalizeAdId(ad.id)}-${i}`}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!advice.themes?.length &&
                    !advice.keywords?.length &&
                    !advice.atsTips?.length && (
                      <p className="empty-state">
                        Ingen specifik ansökningsvägledning för den här
                        tjänsten.
                      </p>
                    )}
                </div>
              ))}
            </div>
          )}

          {/* Full width – gemensamma tips */}
          {overallTips && overallTips.length > 0 && (
            <div className="analysis-subsection dynamic-section-differences">
              <h5>Gemensamma tips – oavsett vilken roll du söker</h5>
              <ul>
                {overallTips.map((tip, i) => (
                  <li key={`overall-${i}`}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </article>
    </section>
  )
}
