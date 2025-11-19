// app/annonsanalys/compare/route.ts
import { NextResponse } from 'next/server';
import {
  analyzeAdsWithGemini,
  type AdsAnalysisResult,
} from '../ai/compareAds';
import { supabaseServer } from '@/lib/supabaseServerClient';

type ErrorResponse = {
  error: string;
};

type RequestBody = {
  ads?: unknown;
  userId?: string;
};

export async function POST(req: Request) {
  let body: RequestBody;

  // 1. Försök läsa JSON-body
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    const res: ErrorResponse = { error: 'Ogiltig JSON i request-body.' };
    return NextResponse.json(res, { status: 400 });
  }

  const { ads, userId } = body;

  // 2. Kontrollera att ads finns och är en array med minst två element
  if (!Array.isArray(ads) || ads.length < 2) {
    const res: ErrorResponse = {
      error:
        'Du måste skicka ett fält "ads" med minst två annonser (array av strängar).',
    };
    return NextResponse.json(res, { status: 400 });
  }

  // 3. Validera och normalisera (trimma) alla annonser
  let normalizedAds: string[];
  try {
    normalizedAds = ads.map((value: unknown, index: number) => {
      if (typeof value !== 'string') {
        throw new Error(`Annons på index ${index} är inte en sträng.`);
      }
      const trimmed = value.trim();
      if (!trimmed) {
        throw new Error(
          `Annons på index ${index} är tom efter trimning.`
        );
      }
      return trimmed;
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Ogiltigt format på annonserna.';
    const res: ErrorResponse = { error: message };
    return NextResponse.json(res, { status: 400 });
  }

  // 4. Minst A & B måste ha innehåll (index 0 och 1)
  if (!normalizedAds[0] || !normalizedAds[1]) {
    const res: ErrorResponse = {
      error:
        'Minst Annons A och Annons B måste innehålla text för att analysen ska kunna köras.',
    };
    return NextResponse.json(res, { status: 400 });
  }

  // 5. Kör AI-analysen via helpern i compareAds.ts
  try {
    const analysis: AdsAnalysisResult =
      await analyzeAdsWithGemini(normalizedAds);

    // 👉 Spara resultatet i Supabase (använder nu ad_rawdata + user_id)
    const { error: insertError } = await supabaseServer
      .from('ad_rawdata')
      .insert({
        raw_ads: normalizedAds,
        result: analysis,
        user_id: userId ?? null,
      });

    if (insertError) {
      console.error('Kunde inte spara analys i Supabase:', insertError);
    }

    // Logga resultatet så vi kan se om sections kommer med
    console.log('AI analysis result:', JSON.stringify(analysis, null, 2));

    return NextResponse.json(analysis);
  } catch (err) {
    console.error('Fel vid AI-analys av annonser:', err);
    const message =
      err instanceof Error
        ? err.message
        : 'AI-analysen misslyckades på grund av ett internt fel.';
    const res: ErrorResponse = { error: message };
    return NextResponse.json(res, { status: 500 });
  }
}
