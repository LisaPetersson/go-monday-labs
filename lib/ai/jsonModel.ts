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

type CallJsonModelParams = {
  input: string
  schema?: Schema
  modelName?: string
}

export async function callJsonModel<T>({
  input,
  schema,
  // ÄNDRA HÄR: använd flash som standard istället för pro
  modelName = 'gemini-2.5-flash',
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
          // (valfritt) begränsa storleken på svaret:
          maxOutputTokens: 2048,
        }
      : {
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
        },
  })

  const raw = result.response.text()
  return JSON.parse(raw) as T
}
