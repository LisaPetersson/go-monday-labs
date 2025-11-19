// app/annonsanalys/ai/compareAds.ts
import { callJsonModel } from '@/lib/ai/jsonModel'
import compareAdsSchema from '../instructions/compareAds.schema.json';

/**
 * Bas-info per annons som används i snabbanalysen.
 */
export type AnalyzedAd = {
  /** Kort id, t.ex. "A", "B", "C" */
  id: string
  /** Namn på rollen/tjänsten, t.ex. "Informationssäkerhetsspecialist" */
  title: string
  /** Namn på arbetsgivaren, om det går att tolka ut */
  company?: string
  /** Kort sammanfattning av vad tjänsten handlar om */
  summary: string
  /** Kombinerad etikett som visas i UI:t, t.ex. "Projektledare IT – Region Skåne" */
  label: string
  /** Matchningsscore 0–100 (kan justeras efter preferensfrågor i frontend) */
  score: number
}

/**
 * Innehåll per annons i en jämförelsesektion.
 */
export type SectionPerAdHighlights = {
  /** Vilken annons detta block gäller ("A", "B", "C" ...) */
  adId: string
  /** Viktiga punkter för den här aspekten i just denna annons */
  highlights: string[]
}

/**
 * Dynamisk jämförelsesektion, används i "Annonsjämförelse".
 */
export type AnalysisSection = {
  /** Teknisk nyckel, t.ex. "role", "requirements" */
  id: string
  /** Rubrik som visas för kandidaten */
  title: string
  /** Kort beskrivning av vad sektionen handlar om */
  description: string
  /** Innehåll per annons (vänster/höger-kolumner) */
  perAd: SectionPerAdHighlights[]
  /** Viktigaste skillnaderna mellan annonserna i just denna sektion */
  key_differences?: string[]
}

/**
 * AI-genererade svarsalternativ i preferensfrågorna.
 */
export type AiPreferenceOption = {
  id: string
  label: string
  /** Vilken annons det här svaret pekar mot ("A", "B", "C" ...) */
  adId: string
}

/**
 * AI-genererade frågor som kandidaten svarar på för att få rekommendation.
 */
export type AiPreferenceQuestion = {
  id: string
  text: string
  options: AiPreferenceOption[]
}

/**
 * Fördjupad analys per tjänst – används i sektionen "Fördjupad analys per tjänst".
 */
export type DeepAnalysisPerAd = {
  adId: string
  /** Vad som talar för tjänsten (styrkor) */
  strengths: string[]
  /** Eventuella risker / saker att vara uppmärksam på */
  risks: string[]
  /** Kultur & arbetssätt – hur det verkar vara att jobba här */
  cultureAndFit: string[]
  /** Utveckling & framtid – hur tjänsten kan bidra till långsiktiga mål */
  development: string[]
}

/**
 * Råd inför ansökan – både generellt och per annons.
 */
export type ApplicationAdvicePerAd = {
  adId: string
  /** Vilka teman du bör lyfta i ansökan för just denna tjänst */
  themes: string[]
  /** Konkreta nyckelord/fraser som passar tjänsten (för både läsare & ATS) */
  keywords: string[]
  /** Specifika ATS-tips, t.ex. fraser eller struktur att tänka på */
  atsTips: string[]
}

export type ApplicationAdvice = {
  /** Övergripande tips som gäller oavsett vilken tjänst du väljer */
  overallTips: string[]
  /** Mer riktade råd per tjänst */
  perAd: ApplicationAdvicePerAd[]
}

/**
 * Hela resultatet som backend skickar till frontend.
 */
export type AdsAnalysisResult = {
  ads: AnalyzedAd[]
  comparison: {
    recommendationAdId?: string
    recommendationLabel?: string
    reason: string
  }
  /** Dynamiska sektioner för "Annonsjämförelse" */
  sections: AnalysisSection[]

  /** Råd inför ansökan (ny sektion i UI:t) */
  applicationAdvice?: ApplicationAdvice

  /** Fördjupad analys per tjänst (ny sektion i UI:t) */
  deepAnalysisPerAd?: DeepAnalysisPerAd[]

  /** Frivilliga frågor för att räkna fram individuell rekommendation */
  questions?: AiPreferenceQuestion[]
}

/** För att inte krascha ev. gammal kod */
export type AdComparisonResult = AdsAnalysisResult

/**
 * Hjälper till att analysera en lista av annonser med Gemini.
 *
 * @param ads Lista med annons-texter (minst två, redan trimmade)
 */
export async function analyzeAdsWithGemini(
  ads: string[]
): Promise<AdsAnalysisResult> {
  if (!Array.isArray(ads) || ads.length < 2) {
    throw new Error('Minst två annonser krävs för analys.')
  }

  // [ANNONS A] ..., [ANNONS B] ...
  const adListText = ads
    .map((text, index) => {
      const labelCharCode = 'A'.charCodeAt(0) + index
      const label = String.fromCharCode(labelCharCode)
      return `[ANNONS ${label}]\n${text}`
    })
    .join('\n\n')

 const schemaText = JSON.stringify(compareAdsSchema, null, 2);

const input = `
Du får en lista med jobbannonser under rubriken ANNONSER.
Skapa ett svar som följer JSON-schemat ANALYSIS_SCHEMA.

ANALYSIS_SCHEMA:
${schemaText}

ANNONSER:
${adListText}
`.trim();



  // 👉 1) Anropa modellen med JSON-schemat så den tvingas följa strukturen
    // Anropa modellen – vi skickar bara in input (ingen schema-parameter)
  const analysis = await callJsonModel<AdsAnalysisResult>({
    input,
  })

  // Säkerställ att comparison alltid finns
  const comparison = analysis.comparison ?? {
    recommendationAdId: undefined,
    recommendationLabel: undefined,
    reason: '',
  }

  // Försök hitta en bra label för fallback-texten
  const recAdId = comparison.recommendationAdId
  const recommendedFromAds =
    (recAdId &&
      analysis.ads.find(
        (ad) =>
          ad.id.trim().toUpperCase() === recAdId.trim().toUpperCase()
      )?.label) ||
    comparison.recommendationLabel

  const fallbackRecommendedLabel =
    recommendedFromAds || 'den rekommenderade tjänsten'

  // Om modellen inte gav någon reason → sätt en vettig motivering ändå
  if (!comparison.reason || !comparison.reason.trim()) {
    comparison.reason = `Utifrån annonsinnehållet framstår ${fallbackRecommendedLabel} som den mest intressanta möjligheten i nuläget.`
  }

  // Säkerställ att varje annons har ett label-fält som kan användas i UI:t
  const normalizedAds = analysis.ads.map((ad) => {
    const fallbackLabel = ad.company ? `${ad.title} – ${ad.company}` : ad.title
    return {
      ...ad,
      label: ad.label ?? fallbackLabel,
    }
  })

  // Returnera analysen med normaliserade ads + säkrad comparison
  return {
    ...analysis,
    ads: normalizedAds,
    comparison,
  }
}
