// app/annonsanalys/components/ComparisonSections.tsx
'use client'

import React from 'react'
import type {
  AdsAnalysisResult,
  AnalysisSection,
  SectionPerAdHighlights,
} from '../ai/compareAds'

type ComparisonSectionsProps = {
  result: AdsAnalysisResult | null
  normalizeAdId: (id: string) => string
}

/** Kolla om sektionen faktiskt har något innehåll att visa */
function hasContentForSection(section: AnalysisSection): boolean {
  const perAdArray: SectionPerAdHighlights[] = Array.isArray(section.perAd)
    ? section.perAd
    : section.perAd
    ? [section.perAd as SectionPerAdHighlights]
    : []

  const anyHighlights = perAdArray.some(
    (item) => Array.isArray(item.highlights) && item.highlights.length > 0
  )

  const anyDifferences =
    Array.isArray(section.key_differences) &&
    section.key_differences.length > 0

  return Boolean(section.description) || anyHighlights || anyDifferences
}

function ComparisonSections({ result, normalizeAdId }: ComparisonSectionsProps) {
  if (!result || !Array.isArray(result.sections) || result.sections.length === 0) {
    return null
  }

  return (
    <section className="workspace-section">
      <h2 className="section-heading">Annonsjämförelse</h2>

      <div className="dynamic-sections">
        {result.sections.map((section) => {
          const perAdArray: SectionPerAdHighlights[] = Array.isArray(section.perAd)
            ? section.perAd
            : section.perAd
            ? [section.perAd as SectionPerAdHighlights]
            : []

          if (!hasContentForSection(section)) {
            return null
          }

          return (
            <article
              key={section.id}
              className="analysis-card dynamic-section-card"
            >
              <div className="analysis-card-header is-expanded">
                <h4>
                  <span className="icon" aria-hidden="true">
                    📌
                  </span>
                  <span>{section.title}</span>
                </h4>
              </div>

              <div className="analysis-card-body">
                {/* Kort intro / beskrivning */}
                {section.description && (
                  <p className="dynamic-section-description">
                    {section.description}
                  </p>
                )}

                {/* Två (eller fler) kolumner – en per tjänst */}
                <div className="dynamic-section-grid">
                  {perAdArray.map((perAd) => {
                    const adMeta = result.ads.find(
                      (ad) =>
                        normalizeAdId(ad.id) ===
                        normalizeAdId(perAd.adId)
                    )

                    const label =
                      adMeta?.label ||
                      `Annons ${normalizeAdId(perAd.adId)}`

                    const highlights = Array.isArray(perAd.highlights)
                      ? perAd.highlights
                      : []

                    return (
                      <div
                        key={`${section.id}-${normalizeAdId(perAd.adId)}`}
                        className="analysis-subsection"
                      >
                        <h5>{label}</h5>
                        {highlights.length > 0 && (
                          <ul>
                            {highlights.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Skillnader – full width under kolumnerna */}
                {Array.isArray(section.key_differences) &&
                  section.key_differences.length > 0 && (
                    <div className="analysis-subsection dynamic-section-differences">
                      <h5>Skillnader att tänka på</h5>
                      <ul>
                        {section.key_differences.map((item, i) => (
                          <li key={i}>{item}</li>
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

export default ComparisonSections
