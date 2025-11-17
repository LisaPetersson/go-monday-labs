// app/annonsanalys/ai/compareAds.ts
import { callJsonModel } from '@/lib/ai/jsonModel'

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

  const input = `
Du är en senior rekryterare och karriärcoach. Du får flera jobbannonser och ska göra en strukturerad analys.

VIKTIGT: Du ska svara ENBART med ett JSON-objekt som följer strukturen nedan.
Inga förklaringar eller text utanför JSON.

STRUKTUR (exakt så här, men anpassat till innehållet):

{
  "ads": [
    {
      "id": "A",
      "title": "Tjänstetitel för annons A",
      "company": "Företagets namn och slutkunden, om det går att se",
      "summary": "Kort sammanfattning av vad rollen går ut på.",
      "score": 0
    }
    // en post per annons ("B", "C" osv)
  ],
  "comparison": {
    "recommendationAdId": "A" | "B" | "C" | null,
    "recommendationLabel": "Tjänst + arbetsgivare som passar bäst baserat på svaren i "questions", t.ex. 'Informationssäkerhetsspecialist hos Rasluson Consult'",
    "reason": "Kort motivering till varför tjänsten som fick flest "score" genom "questions" framstår som mest attraktiv. Till exempel: 'Baserat på dina svar verkar "recommendationLabel" passa dig bäst eftersom du prioriterar X och Y, vilket framgår tydligt i annonsen genom...'"
  },
  "sections": [
    {
      "id": "role",
      "title": "Roll och ansvarsområden",
      "description": "Kort jämförelse av vad man faktiskt gör i tjänsterna.",
      "perAd": [
        {
          "adId": "A",
          "highlights": [
            "konkret punkt om arbetsuppgifter i annons A",
            "ytterligare en punkt"
          ]
        },
        {
          "adId": "B",
          "highlights": [
            "konkret punkt om arbetsuppgifter i annons B"
          ]
        }
      ],
      "key_differences": [
        "hur rollinnehållet skiljer sig mellan tjänsterna",
        "om de är lika kan du skriva att de är liknande och på vilket sätt"
      ]
    }
    // 4–6 liknande sektioner, t.ex. "requirements", "conditions", "culture", "methods", "software", "values", eller andra lämpliga sektioner.
  ],

  "applicationAdvice": {
    "overallTips": [
      "övergripande tips som gäller oavsett vilken tjänst kandidaten söker av de annonserna som är analyserande",
      "t.ex. hur hen kan binda ihop erfarenheter, färdigheter och egenskaper med annonsernas behov" 
    ],
    "perAd": [
      {
        "adId": "A",
        "themes": [
          "Reflekterande förslag på teman att lyfta i personligt brev/CV för den här tjänsten"
        ],
        "keywords": [
          "viktiga ord/fraser från annonsen som är bra att använda",
          "både för mänskliga läsare och ATS"
        ],
        "atsTips": [
          "Reflekterande förslag för hur kandidaten skulle kunna fundera på att formulera sig så att ATS lättare förstår matchningen"
        ]
      }
      // en motsvarande post per annons
    ]
  },

  "deepAnalysisPerAd": [
    {
      "adId": "A",
      "strengths": [
        "vad som är extra positivt med den här tjänsten",
        "vilka typer av kandidater som kan trivas"
      ],
      "risks": [
        "eventuella nackdelar eller fallgropar man bör känna till"
      ],
      "cultureAndFit": [
        "vad man kan utläsa om kultur, arbetssätt och ledarskap"
      ],
      "development": [
        "hur tjänsten kan bidra till långsiktiga mål och karriärutveckling"
      ]
    }
    // en post per annons
  ],

  "questions": [
    {
      "id": "q1",
      "text": "Reflekterande fråga som hjälper kandidaten att välja mellan tjänsterna.",
      "options": [
        {
          "id": "q1_a",
          "label": "svarsalternativ som pekar tydligt mot en viss typ av tjänst",
          "adId": "A"
        },
        {
          "id": "q1_b",
          "label": "svarsalternativ som pekar mot en annan tjänst",
          "adId": "B"
        }
      ]
    }
    // totalt 5–7 frågor
  ]
}

REGLER:
- "applicationAdvice" ska använd formuleringar som är reflekterande exemplvis; "Du skulle kunna...", "Kanske kan du...", "Ett exempel är...", "Fundera på att...". Var explicit med att användaren ska anpassa sina dokument efter varje tjänst som sökes.
- "reason" i "comparison" ska vara tydlig med varför en viss tjänst rekommenderas.
- "ads" måste innehålla en post per annons. "id" ska vara "A", "B", "C" osv.
- "summary" ska vara 2–4 meningar som verkligen hjälper kandidaten att förstå tjänsten.
- "score" är en bedömning 0–100 baserat på svaren användaren ger på frågorna i "questions".
- Skapa 5-7 "keyword" i "applicationAdvice" som är relevanta för just den tjänsten.
- Skapa 4–6 sektioner i "sections" med perAd-innehåll och key_differences.
- Skapa 5–7 frågor i "questions", där varje svarsalternativ kopplas till exakt EN annons via "adId".
- Skapa både "applicationAdvice" och "deepAnalysisPerAd" enligt mallen ovan.

Här är annonserna:

${adListText}
`.trim()

  // 👉 1) Anropa modellen med JSON-schemat så den tvingas följa strukturen
    // Anropa modellen – vi skickar bara in input (ingen schema-parameter)
  const analysis = await callJsonModel<AdsAnalysisResult>({
    input,
  })

  // Säkerställ att comparison alltid finns
  let comparison = analysis.comparison ?? {
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
