// lib/ai/jsonModel.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  throw new Error('GEMINI_API_KEY saknas i .env.local')
}

const genAI = new GoogleGenerativeAI(apiKey)

type CallJsonModelParams = {
  input: string
  modelName?: string
}

/**
 * Anropa Gemini och få tillbaka ett JSON-objekt.
 * Vi är extra defensiva i hur vi plockar ut och parsar svaret.
 */
export async function callJsonModel<T>({
  input,
  modelName = 'gemini-2.5-flash-lite',
}: CallJsonModelParams): Promise<T> {
  const model = genAI.getGenerativeModel({ model: modelName })

  let result
  try {
    result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: input }],
        },
      ],
      generationConfig: {
        // vi ber modellen svara med JSON, men förlitar oss inte blint på det
        responseMimeType: 'application/json',
      },
    })
  } catch (err) {
    console.error('Gemini generateContent kastade fel:', err)

    let message = 'Kunde inte kontakta AI-modellen.'
    if (err instanceof Error) {
      message = err.message
    } else if (typeof err === 'object' && err !== null) {
      const maybeToString = (err as { toString?: () => string }).toString
      if (typeof maybeToString === 'function') {
        message = maybeToString()
      }
    }

    const maybeStatus =
      typeof err === 'object' && err !== null
        ? (err as { status?: unknown }).status
        : undefined

    if (
      typeof maybeStatus === 'number' ||
      typeof maybeStatus === 'string'
    ) {
      message += ` (status: ${maybeStatus})`
    }

    throw new Error(message)
  }

  // --------- Plocka ut råtexten ----------

  type Part = { text?: string }
  type Candidate = { content?: { parts?: Part[] } }
  type GeminiResponse = {
    text?: () => string
    candidates?: Candidate[]
    promptFeedback?: {
      blockReason?: string
      safetyRatings?: unknown[]
    }
  }

  const response = result.response as GeminiResponse

  let raw = ''
  if (typeof response.text === 'function') {
    const maybeText = response.text()
    if (typeof maybeText === 'string') {
      raw = maybeText
    }
  }

  // fallback: bygg text från candidates/parts
  if ((!raw || !raw.trim()) && response.candidates?.length) {
    raw = response.candidates
      .map((candidate) =>
        (candidate.content?.parts ?? [])
          .map((part) => part.text ?? '')
          .join('')
      )
      .join('\n')
      .trim()
  }

  if (!raw || !raw.trim()) {
    console.error('Gemini svarade utan text.')
    console.error('promptFeedback:', response.promptFeedback)
    console.error('Hela response-objektet:', response)

    if (response.promptFeedback?.blockReason) {
      throw new Error(
        `AI-svaret blockerades av säkerhetsregler (blockReason: ${response.promptFeedback.blockReason}).`
      )
    }

    throw new Error('Modellen returnerade inget innehåll (tomt svar).')
  }

  // --------- Städa upp JSON-strängen ----------

  let cleaned = raw.trim()

  // Ta bort ```json / ``` runt
  cleaned = cleaned.replace(/^```json/i, '')
  cleaned = cleaned.replace(/^```/, '')
  cleaned = cleaned.replace(/```$/, '')
  cleaned = cleaned.trim()

  // Ta bara ut första {...}-blocket om modellen har skrivit extra text
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  // Ta bort "trailing commas", som ibland smyger sig in
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

  // --------- Försök parsa JSON ----------

  try {
    return JSON.parse(cleaned) as T
  } catch (err) {
    console.error('Kunde inte parsa JSON från modellen.', err)
    console.error('Råtext före städning var:\n', raw)
    console.error('Text efter städning var:\n', cleaned)
    throw new Error('Kunde inte tolka JSON-svaret från modellen.')
  }
}
