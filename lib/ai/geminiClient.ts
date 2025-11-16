// lib/ai/geminiClient.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.warn(
    'GEMINI_API_KEY saknas i miljövariablerna. Direktanrop till getGeminiModel kommer att kasta fel.'
  )
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

export function getGeminiModel(modelName = 'gemini-2.5-flash-lite') {
  if (!genAI) {
    throw new Error(
      'GEMINI_API_KEY saknas i serverns miljövariabler. ' +
        'Lägg till den i Netlify under Environment variables.'
    )
  }

  return genAI.getGenerativeModel({ model: modelName })
}
