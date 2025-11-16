// app/annonsanalys/components/DeepAnalysisSection.tsx
import type { AdsAnalysisResult } from '../ai/compareAds'

type Props = {
  result: AdsAnalysisResult | null
  normalizeAdId: (id: string) => string
}

export default function DeepAnalysisSection({ result, normalizeAdId }: Props) {
  if (!result || !result.deepAnalysisPerAd || result.deepAnalysisPerAd.length === 0) {
    return null
  }

  const deep = result.deepAnalysisPerAd

  const getDeepForAd = (adId: string) =>
    deep.find((item) => normalizeAdId(item.adId) === normalizeAdId(adId))

  const labelForAd = (ad: AdsAnalysisResult['ads'][number]) => {
    const title = ad.title?.trim() || 'Okänd roll'
    const company = ad.company?.trim()
    return company ? `${title} – ${company}` : title
  }

  // Kolla om det faktiskt finns något innehåll alls
  const hasAnyContent = deep.some((d) =>
    (d.strengths?.length ?? 0) +
      (d.risks?.length ?? 0) +
      (d.cultureAndFit?.length ?? 0) +
      (d.development?.length ?? 0) >
    0
  )

  if (!hasAnyContent) return null

  return (
    <section className="workspace-section">
      <h2 className="section-heading">Fördjupad analys per tjänst</h2>
     <p><i>Ev. pro-funktion som endast syns efter matchning</i></p>
      <div className="cards-flex">
        {result.ads.map((ad) => {
          const deepAd = getDeepForAd(ad.id)

          if (!deepAd) {
            // Om modellen inte gav något för just denna annons: hoppa över kortet
            return null
          }

          const { strengths, risks, cultureAndFit, development } = deepAd

          const hasContent =
            (strengths?.length ?? 0) +
              (risks?.length ?? 0) +
              (cultureAndFit?.length ?? 0) +
              (development?.length ?? 0) >
            0

          if (!hasContent) return null

          return (
            <article
              key={normalizeAdId(ad.id)}
              className="analysis-card"
            >
              <div className="analysis-card-header is-expanded">
                <h4>
                  <span className="icon" aria-hidden="true">
                    🔍
                  </span>
                  <span>{labelForAd(ad)}</span>
                </h4>
              </div>
              <div className="analysis-card-body">
                {strengths && strengths.length > 0 && (
                  <div className="analysis-subsection">
                    <h5>Styrkor med rollen</h5>
                    <ul>
                      {strengths.map((item, i) => (
                        <li key={`str-${normalizeAdId(ad.id)}-${i}`}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {risks && risks.length > 0 && (
                  <div className="analysis-subsection">
                    <h5>Risker / saker att vara uppmärksam på</h5>
                    <ul>
                      {risks.map((item, i) => (
                        <li key={`risk-${normalizeAdId(ad.id)}-${i}`}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cultureAndFit && cultureAndFit.length > 0 && (
                  <div className="analysis-subsection">
                    <h5>Kultur &amp; arbetssätt</h5>
                    <ul>
                      {cultureAndFit.map((item, i) => (
                        <li key={`cult-${normalizeAdId(ad.id)}-${i}`}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {development && development.length > 0 && (
                  <div className="analysis-subsection">
                    <h5>Utveckling &amp; framtid</h5>
                    <ul>
                      {development.map((item, i) => (
                        <li key={`dev-${normalizeAdId(ad.id)}-${i}`}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
