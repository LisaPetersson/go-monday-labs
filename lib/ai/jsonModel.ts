// lib/ai/jsonModel.ts
import {
  GoogleGenerativeAI,
  type Schema,
} from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  throw new Error('GEMINI_API_KEY saknas i .env.local')
}

const genAI = new GoogleGenerativeAI(apiKey)

/**
 * Parametrar till callJsonModel.
 * (Ingen generic här – T används bara på funktionen.)
 */
type CallJsonModelParams = {
  input: string
  /**
   * JSON-schema (t.ex. din compareAds.schema.json) som modellen ska följa.
   */
  schema?: Schema
  modelName?: string
}

/**
 * Generiskt anrop mot Gemini där vi:
 * - tvingar JSON-svar
 * - (valfritt) anger responseSchema = hela schemat du skickar in
 * - parsar svaret till T
 */
export async function callJsonModel<T>({
  input,
  schema,
  modelName = 'gemini-2.5-pro',
}: CallJsonModelParams): Promise<T> {
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
        }
      : {
          responseMimeType: 'application/json',
        },
  })

  const raw = result.response.text()
  // console.log('Raw JSON from model:', raw)

  try {
    return JSON.parse(raw) as T
  } catch (err) {
    console.error('Kunde inte parsa JSON från modellen:', err)
    console.error('Råtext var:', raw)
    throw new Error('Kunde inte tolka JSON-svaret från modellen.')
  }
}
