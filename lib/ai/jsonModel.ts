// lib/ai/jsonModel.ts
import {
  GoogleGenerativeAI,
  type Schema,
} from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  // Viktigt: kasta INTE här – det gör att hela funktionen kraschar innan vår route hinner fånga felet.
  console.warn(
    'GEMINI_API_KEY saknas i miljövariablerna. AI-funktioner kommer inte fungera förrän den sätts.'
  )
}

// Om nyckeln finns skapar vi klienten, annars lämnar vi den som null
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

/**
 * Parametrar till callJsonModel.
 */
type CallJsonModelParams = {
  input: string
  schema?: Schema
  modelName?: string
}

/**
 * Anropar en Gemini-modell som returnerar JSON.
 */
export async function callJsonModel<T>({
  input,
  schema,
  modelName = 'gemini-2.5-flash', // snabbare modell passar Netlify bättre
}: CallJsonModelParams): Promise<T> {
  if (!genAI) {
    throw new Error(
      'GEMINI_API_KEY saknas i serverns miljövariabler. ' +
        'Lägg till den i Netlify under Environment variables.'
    )
  }

  const model = genAI.getGenerativeModel({ model: modelName })

  const hasSchema = Boolean(schema)

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: input }],
      },
    ],
    generationConfig: hasSchema
      ? {
          responseMimeType: 'application/json',
          responseSchema: schema,
          maxOutputTokens: 2048,
        }
      : {
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
        },
  })

  const raw = result.response.text()

  if (!raw) {
    throw new Error('Modellen returnerade inget innehåll (tomt svar).')
  }

  try {
    return JSON.parse(raw) as T
  } catch (err) {
    console.error('Kunde inte parsa JSON från modellen:', err)
    console.error('Råtext var:', raw)
    throw new Error('Kunde inte tolka JSON-svaret från modellen.')
  }
}
