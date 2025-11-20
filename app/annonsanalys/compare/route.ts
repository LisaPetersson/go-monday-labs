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

// Typ för insert till ad_analysis_tokens
type InsertableToken = {
  user_id: string | null;
  analysis_id: string;
  ad_id: string | null;
  source_block: string;
  section_id: string | null;
  token_type: string;
  token_text: string;
  position: number | null;
};

/**
 * Plockar ut alla små-bitar från AdsAnalysisResult och gör dem
 * till en platt lista som vi kan stoppa i ad_analysis_tokens.
 */
function extractTokensFromAnalysis(
  analysis: AdsAnalysisResult,
  analysisId: string,
  userId: string | null
): InsertableToken[] {
  const tokens: InsertableToken[] = [];

  // --- 1) ApplicationAdvice.perAd: themes, keywords, atsTips ---
  if (analysis.applicationAdvice?.perAd) {
    for (const perAd of analysis.applicationAdvice.perAd) {
      const adId = perAd.adId;

      (perAd.themes ?? []).forEach((theme, idx) => {
        tokens.push({
          user_id: userId,
          analysis_id: analysisId,
          ad_id: adId,
          source_block: 'applicationAdvice',
          section_id: null,
          token_type: 'theme',
          token_text: theme,
          position: idx,
        });
      });

      (perAd.keywords ?? []).forEach((kw, idx) => {
        tokens.push({
          user_id: userId,
          analysis_id: analysisId,
          ad_id: adId,
          source_block: 'applicationAdvice',
          section_id: null,
          token_type: 'keyword',
          token_text: kw,
          position: idx,
        });
      });

      (perAd.atsTips ?? []).forEach((tip, idx) => {
        tokens.push({
          user_id: userId,
          analysis_id: analysisId,
          ad_id: adId,
          source_block: 'applicationAdvice',
          section_id: null,
          token_type: 'ats_tip',
          token_text: tip,
          position: idx,
        });
      });
    }
  }

  // --- 2) deepAnalysisPerAd: strengths, risks, cultureAndFit, development ---
  if (analysis.deepAnalysisPerAd) {
    for (const deep of analysis.deepAnalysisPerAd) {
      const adId = deep.adId;

      (deep.strengths ?? []).forEach((s, idx) => {
        tokens.push({
          user_id: userId,
          analysis_id: analysisId,
          ad_id: adId,
          source_block: 'deepAnalysis',
          section_id: null,
          token_type: 'strength',
          token_text: s,
          position: idx,
        });
      });

      (deep.risks ?? []).forEach((r, idx) => {
        tokens.push({
          user_id: userId,
          analysis_id: analysisId,
          ad_id: adId,
          source_block: 'deepAnalysis',
          section_id: null,
          token_type: 'risk',
          token_text: r,
          position: idx,
        });
      });

      (deep.cultureAndFit ?? []).forEach((c, idx) => {
        tokens.push({
          user_id: userId,
          analysis_id: analysisId,
          ad_id: adId,
          source_block: 'deepAnalysis',
          section_id: null,
          token_type: 'culture',
          token_text: c,
          position: idx,
        });
      });

      (deep.development ?? []).forEach((d, idx) => {
        tokens.push({
          user_id: userId,
          analysis_id: analysisId,
          ad_id: adId,
          source_block: 'deepAnalysis',
          section_id: null,
          token_type: 'development',
          token_text: d,
          position: idx,
        });
      });
    }
  }

  // --- 3) sections: perAd.highlights + key_differences ---
  if (analysis.sections) {
    for (const section of analysis.sections) {
      const sectionId = section.id;

      // perAd-highlights
      for (const perAd of section.perAd ?? []) {
        const adId = perAd.adId;

        (perAd.highlights ?? []).forEach((h, idx) => {
          tokens.push({
            user_id: userId,
            analysis_id: analysisId,
            ad_id: adId,
            source_block: 'sections',
            section_id: sectionId,
            token_type: 'highlight',
            token_text: h,
            position: idx,
          });
        });
      }

      // key_differences (gäller ofta jämförelsen mellan annonser)
      (section.key_differences ?? []).forEach((diff, idx) => {
        tokens.push({
          user_id: userId,
          analysis_id: analysisId,
          ad_id: null,
          source_block: 'sections',
          section_id: sectionId,
          token_type: 'key_difference',
          token_text: diff,
          position: idx,
        });
      });
    }
  }

  return tokens;
}

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
        throw new Error(`Annons på index ${index} är tom efter trimning.`);
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

    // 👉 Spara resultatet i Supabase (ad_rawdata + user_id)
    const comparison = analysis.comparison ?? {};
    const recommendedAdId = comparison.recommendationAdId ?? null;
    const recommendedLabel = comparison.recommendationLabel ?? null;

    // 1) Spara själva analysen och få tillbaka id + user_id
    const { data: insertedAnalysis, error: insertError } = await supabaseServer
      .from('ad_rawdata')
      .insert({
        raw_ads: normalizedAds,
        result: analysis,
        user_id: userId ?? null,
        recommended_ad_id: recommendedAdId,
        recommended_label: recommendedLabel,
      })
      .select('id, user_id')
      .single();

    if (insertError) {
      console.error('Kunde inte spara analys i Supabase:', insertError);
    } else if (insertedAnalysis) {
      const analysisId = insertedAnalysis.id as string;
      const ownerId =
        (insertedAnalysis as { user_id: string | null }).user_id ?? null;

      // 2) Plocka ut tokens ur AI-resultatet
      const tokens = extractTokensFromAnalysis(analysis, analysisId, ownerId);

      if (tokens.length > 0) {
        const { error: tokensError } = await supabaseServer
          .from('ad_analysis_tokens')
          .insert(tokens);

        if (tokensError) {
          console.error('Kunde inte spara analysis tokens:', tokensError);
        }
      }
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
