// app/dashboard/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServerClient";

type TokenRow = {
  id: string;
  analysis_id: string;
  ad_id: string | null;
  source_block: string;
  section_id: string | null;
  token_type: string;
  token_text: string;
  created_at: string;
};

// Så här ser varje annons ut i AI-resultatet (enligt compareAds.schema.json)
type ResultAd = {
  id?: string | null;
  label?: string | null; // ex: "Bolagsjurist – X AB"
  summary?: string | null;
  score?: number | null;
};

type AnalysisResultRow = {
  ads?: ResultAd[] | null;
};

type AnalysisRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  recommended_ad_id: string | null;
  recommended_label: string | null;
  raw_ads: unknown;
  result: unknown;
};

type RoleTraitStats = {
  analysisCount: number;
  traitTokenCount: number;
  traitCounts: Record<string, number>;
};

// Hjälpfunktion: kolla om en analys matchar en roll-sökning
function analysisMatchesRole(a: AnalysisRow, roleQuery: string): boolean {
  if (!roleQuery) return false;
  const q = roleQuery.toLowerCase().trim();
  if (!q) return false;

  // 1) Försök först matcha på AI-resultatets ads[].label/summary
  const r = a.result as AnalysisResultRow | null;
  const ads = Array.isArray(r?.ads) ? r.ads ?? [] : [];

  for (const ad of ads) {
    const label = (ad.label ?? "").toString().toLowerCase();
    const summary = (ad.summary ?? "").toString().toLowerCase();
    if (label.includes(q) || summary.includes(q)) {
      return true;
    }
  }

  // 2) Fallback: sök i råannons-texten (raw_ads)
  const raw = JSON.stringify(a.raw_ads ?? "").toLowerCase();
  if (raw.includes(q)) {
    return true;
  }

  return false;
}

// Hämta stats (antal analyser, tokens och counts per trait) för en roll-query
function getRoleTraitStats(
  roleQuery: string,
  analyses: AnalysisRow[],
  tokens: TokenRow[]
): RoleTraitStats {
  const q = roleQuery.trim();
  if (!q) {
    return { analysisCount: 0, traitTokenCount: 0, traitCounts: {} };
  }

  const roleAnalyses = analyses.filter((a) => analysisMatchesRole(a, q));
  const roleAnalysisIds = new Set(roleAnalyses.map((a) => a.id));

  const traitTypes = new Set(["strength", "theme"]);

  const roleTraitTokens = tokens.filter(
    (t) => roleAnalysisIds.has(t.analysis_id) && traitTypes.has(t.token_type)
  );

  const traitCounts = roleTraitTokens.reduce<Record<string, number>>(
    (acc, t) => {
      const key = t.token_text.trim();
      if (!key) return acc;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return {
    analysisCount: roleAnalyses.length,
    traitTokenCount: roleTraitTokens.length,
    traitCounts,
  };
}

function getFirstParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Vänta in ReactPromise -> vanligt objekt
  const resolvedSearchParams =
    (await searchParams) ??
    ({} as { [key: string]: string | string[] | undefined });

  // ----- Single-roll (Snabba insikter) -----
  const roleParam = getFirstParam(resolvedSearchParams.role);
  const roleQuery =
    typeof roleParam === "string" ? roleParam.trim().toLowerCase() : "";

  // ----- Jämförelse: två roller -----
  const roleAParam = getFirstParam(resolvedSearchParams.roleA);
  const roleBParam = getFirstParam(resolvedSearchParams.roleB);

  const roleAQuery =
    typeof roleAParam === "string" ? roleAParam.trim().toLowerCase() : "";
  const roleBQuery =
    typeof roleBParam === "string" ? roleBParam.trim().toLowerCase() : "";

  // Debug (kan kommenteras bort när det funkar)
  console.log("Dashboard searchParams", resolvedSearchParams);
  console.log("Dashboard role debug (single)", { roleParam, roleQuery });
  console.log("Dashboard role compare debug", {
    roleAParam,
    roleAQuery,
    roleBParam,
    roleBQuery,
  });

  // Hämta data från Supabase – körs på servern
  const [
    { data: tokensData, error: tokensError },
    { data: analysesData, error: analysesError },
  ] = await Promise.all([
    supabaseServer
      .from("ad_analysis_tokens")
      .select(
        "id, analysis_id, ad_id, source_block, section_id, token_type, token_text, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    supabaseServer
      .from("ad_rawdata")
      .select(
        "id, created_at, user_id, recommended_ad_id, recommended_label, raw_ads, result"
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const tokens = (tokensData ?? []) as TokenRow[];
  const analyses = (analysesData ?? []) as AnalysisRow[];

  const hasError = !!tokensError || !!analysesError;

  // -------- Översikts-aggregat (alla analyser) --------
  const tokensByType = tokens.reduce<Record<string, number>>((acc, t) => {
    acc[t.token_type] = (acc[t.token_type] ?? 0) + 1;
    return acc;
  }, {});

  const tokensBySource = tokens.reduce<Record<string, number>>((acc, t) => {
    acc[t.source_block] = (acc[t.source_block] ?? 0) + 1;
    return acc;
  }, {});

  const totalTokens = tokens.length;
  const tokenTypeEntries = Object.entries(tokensByType).sort(
    (a, b) => b[1] - a[1]
  );
  const tokenSourceEntries = Object.entries(tokensBySource).sort(
    (a, b) => b[1] - a[1]
  );

  const recentTokens = tokens.slice(0, 30);

  // Map för att snabbt hitta analys per token
  const analysisById = new Map(analyses.map((a) => [a.id, a] as const));

  // Hjälpfunktion: ta fram roll & arbetsgivare för en token
  const getRoleAndEmployerForToken = (
    t: TokenRow
  ): { role: string; employer: string } => {
    const analysis = analysisById.get(t.analysis_id);
    if (!analysis) return { role: "—", employer: "—" };

    const r = analysis.result as AnalysisResultRow | null;
    const ads = Array.isArray(r?.ads) ? r.ads ?? [] : [];
    if (ads.length === 0) return { role: "—", employer: "—" };

    let ad: ResultAd | undefined;

    // 1) Försök matcha på ad_id (A/B/C…)
    if (t.ad_id) {
      ad = ads.find((a) => a.id === t.ad_id) ?? undefined;
    }

    // 2) Fallback: använd rekommenderad annons om satt
    if (!ad && analysis.recommended_ad_id) {
      ad = ads.find((a) => a.id === analysis.recommended_ad_id) ?? undefined;
    }

    // 3) Sista fallback: första annonsen
    if (!ad) {
      ad = ads[0];
    }

    const label = (ad?.label ?? "").toString().trim();
    if (!label) return { role: "—", employer: "—" };

    // Försök dela på " – " (en dash) annars vanlig "-".
    const parts = label.includes("–") ? label.split("–") : label.split("-");
    const role = parts[0]?.trim() || label;
    const employer = parts[1]?.trim() || "—";

    return { role, employer };
  };

  // -------- Dynamisk insikt: single-roll --------
  const singleStats = getRoleTraitStats(roleQuery, analyses, tokens);
  const roleAnalysisCount = singleStats.analysisCount;
  const roleTraitTokenCount = singleStats.traitTokenCount;
  const topRoleTraits = Object.entries(singleStats.traitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // -------- Jämförelse: två roller --------
  const roleAStats = getRoleTraitStats(roleAQuery, analyses, tokens);
  const roleBStats = getRoleTraitStats(roleBQuery, analyses, tokens);

  type TraitComparisonRow = {
    trait: string;
    countA: number;
    countB: number;
    total: number;
  };

  let comparisonRows: TraitComparisonRow[] = [];

  if (roleAQuery && roleBQuery) {
    const allTraits = new Set([
      ...Object.keys(roleAStats.traitCounts),
      ...Object.keys(roleBStats.traitCounts),
    ]);

    comparisonRows = Array.from(allTraits).map((trait) => {
      const countA = roleAStats.traitCounts[trait] ?? 0;
      const countB = roleBStats.traitCounts[trait] ?? 0;
      return {
        trait,
        countA,
        countB,
        total: countA + countB,
      };
    });

    comparisonRows.sort((a, b) => b.total - a.total);
    comparisonRows = comparisonRows.slice(0, 10);
  }

  const maxBarCount =
    comparisonRows.length > 0
      ? Math.max(
          ...comparisonRows.map((r) => Math.max(r.countA, r.countB, 1))
        )
      : 1;

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              Dashboard (admin)
            </h1>
            <p className="mt-2 text-sm text-zinc-600 max-w-xl">
              Intern vy för att utforska data från annonsanalysen. Här
              visualiseras information från{" "}
              <code className="font-mono text-xs bg-zinc-100 px-1 py-0.5 rounded">
                ad_analysis_tokens
              </code>{" "}
              och{" "}
              <code className="font-mono text-xs bg-zinc-100 px-1 py-0.5 rounded">
                ad_rawdata
              </code>
              .
            </p>
          </div>

          <Link
            href="/"
            className="text-sm text-zinc-600 hover:text-zinc-900 underline-offset-4 hover:underline"
          >
            ← Tillbaka till startsidan
          </Link>
        </header>

        {/* Ev. felmeddelande */}
        {hasError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Kunde inte hämta all data från Supabase. Kontrollera att tabellerna{" "}
            <code className="font-mono text-xs">ad_analysis_tokens</code> och{" "}
            <code className="font-mono text-xs">ad_rawdata</code> finns och att
            kolumnnamnen stämmer. Se även serverloggen för detaljer.
          </div>
        )}

        {/* SNABBA INSIKTER (single roll) */}
        <section className="mb-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Snabba insikter
            </h2>

            {/* Sökfält för roll */}
            <form
              method="get"
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <label className="text-xs font-medium text-zinc-600">
                Filtrera teman efter roll/yrkestitel
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="role"
                  placeholder="t.ex. webbdesigner, frontendutvecklare..."
                  defaultValue={typeof roleParam === "string" ? roleParam : ""}
                  className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                />
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                >
                  Visa insikter
                </button>
              </div>
            </form>
          </div>

          {/* Vanligaste teman – full width */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-800 mb-1">
              {roleQuery
                ? <>Vanligaste teman för ”{roleParam}”</>
                : "Vanligaste teman för vald roll"}
            </h3>
            <p className="text-xs text-zinc-500 mb-3">
              Baserat på tokens av typen{" "}
              <code className="font-mono text-[10px] bg-zinc-100 px-1 py-0.5 rounded">
                strength
              </code>{" "}
              och{" "}
              <code className="font-mono text-[10px] bg-zinc-100 px-1 py-0.5 rounded">
                theme
              </code>{" "}
              i analyser där AI:et har tolkat annonsens titel/label så att
              den innehåller den sökta rollen (eller där ordet förekommer i
              råtexten).
            </p>

            {!roleQuery ? (
              <p className="text-sm text-zinc-500">
                Skriv in en roll/yrkestitel ovan för att se vilka teman
                som oftast nämns i annonserna.
              </p>
            ) : roleAnalysisCount === 0 ? (
              <p className="text-sm text-zinc-500">
                Hittade inga analyser där AI:et eller råtexten innehåller
                rollen “<span className="font-semibold">{roleParam}</span>”.
                Prova en annan benämning eller kör fler analyser.
              </p>
            ) : topRoleTraits.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Det finns analyser för “
                <span className="font-semibold">{roleParam}</span>”, men inga
                tokens av typen “strength/theme” ännu.
              </p>
            ) : (
              <>
                <p className="text-xs text-zinc-500 mb-3">
                  Baserat på{" "}
                  <span className="font-semibold">{roleAnalysisCount}</span>{" "}
                  analyser och{" "}
                  <span className="font-semibold">{roleTraitTokenCount}</span>{" "}
                  teman-tokens.
                </p>
                <ol className="space-y-1 text-sm text-zinc-800">
                  {topRoleTraits.map(([trait, count], index) => (
                    <li
                      key={trait}
                      className="flex justify-between rounded-lg bg-zinc-50 px-3 py-1.5"
                    >
                      <span>
                        <span className="mr-2 text-xs text-zinc-400">
                          {index + 1}.
                        </span>
                        {trait}
                      </span>
                      <span className="tabular-nums text-xs text-zinc-500">
                        {count} st
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </section>

        {/* JÄMFÖR TVÅ ROLLER */}
        <section className="mb-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Jämför två roller
            </h2>
            <form
              method="get"
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-600">
                  Roll A
                </label>
                <input
                  type="text"
                  name="roleA"
                  placeholder="t.ex. jurist humanjuridik"
                  defaultValue={typeof roleAParam === "string" ? roleAParam : ""}
                  className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-600">
                  Roll B
                </label>
                <input
                  type="text"
                  name="roleB"
                  placeholder="t.ex. jurist affärsrätt"
                  defaultValue={typeof roleBParam === "string" ? roleBParam : ""}
                  className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                />
              </div>
              <button
                type="submit"
                className="mt-2 sm:mt-5 inline-flex items-center rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                Jämför roller
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-800 mb-1">
              Teman för Roll A vs Roll B
            </h3>
            <p className="text-xs text-zinc-500 mb-3">
              Visar de vanligaste teman (strength/theme) i annonserna
              för respektive roll. Bra för att se skillnader mellan t.ex.
              “jurist inom humanjuridik” och “jurist inom affärsrätt”.
            </p>

            {!roleAQuery || !roleBQuery ? (
              <p className="text-sm text-zinc-500">
                Fyll i både Roll A och Roll B ovan för att se en jämförelse.
              </p>
            ) : roleAStats.analysisCount === 0 &&
              roleBStats.analysisCount === 0 ? (
              <p className="text-sm text-zinc-500">
                Hittade inga analyser där AI:et eller råtexten innehåller någon
                av rollerna “<span className="font-semibold">{roleAParam}</span>
                ” eller “<span className="font-semibold">{roleBParam}</span>”.
                Prova andra formuleringar eller kör fler analyser.
              </p>
            ) : comparisonRows.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Det finns analyser för minst en av rollerna men inga
                strength/theme-tokens att jämföra ännu.
              </p>
            ) : (
              <>
                <div className="flex justify-between text-[11px] text-zinc-500 mb-2">
                  <span>
                    Roll A:{" "}
                    <span className="font-semibold">{roleAParam}</span> (
                    {roleAStats.analysisCount} analyser)
                  </span>
                  <span>
                    Roll B:{" "}
                    <span className="font-semibold">{roleBParam}</span> (
                    {roleBStats.analysisCount} analyser)
                  </span>
                </div>

                <div className="space-y-4">
                  {comparisonRows.map((row) => (
                    <div key={row.trait} className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-700">
                        <span>{row.trait}</span>
                        <span className="tabular-nums text-zinc-500">
                          A: {row.countA} • B: {row.countB}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Stapel för Roll A */}
                        <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-zinc-900/80"
                            style={{
                              width: `${(row.countA / maxBarCount) * 100}%`,
                            }}
                          />
                        </div>
                        {/* Stapel för Roll B */}
                        <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-zinc-500/80"
                            style={{
                              width: `${(row.countB / maxBarCount) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px] text-zinc-500">
                        <span>Roll A</span>
                        <span>Roll B</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Övriga kort + tabeller (samma som innan) */}
        <section className="grid gap-6 md:grid-cols-3 mb-10">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-500 mb-2">
              Totalt antal tokens
            </h2>
            <p className="text-3xl font-semibold text-zinc-900">
              {totalTokens}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Varje theme/keyword/risk osv. från AI-svaren motsvarar en rad i{" "}
              <code className="font-mono text-[10px] bg-zinc-100 px-1 py-0.5 rounded">
                ad_analysis_tokens
              </code>
              .
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-500 mb-2">
              Vanligaste token-typer
            </h2>
            {tokenTypeEntries.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Inga tokens ännu – kör en analys först.
              </p>
            ) : (
              <ul className="space-y-1 text-sm text-zinc-700">
                {tokenTypeEntries.slice(0, 5).map(([type, count]) => (
                  <li key={type} className="flex justify-between">
                    <span className="font-medium">{type}</span>
                    <span className="tabular-nums text-zinc-500">
                      {count} st
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-500 mb-2">
              Varifrån i analysen?
            </h2>
            {tokenSourceEntries.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Inga tokens ännu – kör en analys först.
              </p>
            ) : (
              <ul className="space-y-1 text-sm text-zinc-700">
                {tokenSourceEntries.slice(0, 5).map(([src, count]) => (
                  <li key={src} className="flex justify-between">
                    <span className="font-medium">{src}</span>
                    <span className="tabular-nums text-zinc-500">
                      {count} st
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Senaste tokens + senaste analyser – full width, under varandra */}
        <section className="space-y-6">
          {/* Senaste tokens – full width */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium text-zinc-900 mb-3">
              Senaste tokens (ad_analysis_tokens)
            </h2>
            {recentTokens.length === 0 ? (
              <p className="text-sm text-zinc-500">Inga tokens sparade ännu.</p>
            ) : (
              <div className="overflow-x-auto max-h-[420px]">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                      <th className="py-2 pr-3">Typ</th>
                      <th className="py-2 pr-3">Roll</th>
                      <th className="py-2 pr-3">Arbetsgivare</th>
                      <th className="py-2 pr-3">Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTokens.map((t) => {
                      const { role, employer } = getRoleAndEmployerForToken(t);
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-zinc-100 last:border-0 align-top"
                        >
                          <td className="py-2 pr-3 text-xs font-medium text-zinc-800 whitespace-nowrap">
                            {t.token_type}
                          </td>
                          <td className="py-2 pr-3 text-xs text-zinc-800 whitespace-nowrap">
                            {role}
                          </td>
                          <td className="py-2 pr-3 text-xs text-zinc-600 whitespace-nowrap">
                            {employer}
                          </td>
                          <td className="py-2 pr-3 text-xs text-zinc-800 max-w-[420px]">
                            {t.token_text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Senaste analyser – under tokens, också full width */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium text-zinc-900 mb-3">
              Senaste analyser (ad_rawdata)
            </h2>
            {analyses.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Inga analyser sparade ännu.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                      <th className="py-2 pr-4">ID</th>
                      <th className="py-2 pr-4">Datum</th>
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Rekommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-zinc-100 last:border-0"
                      >
                        <td className="py-2 pr-4 align-top text-xs text-zinc-500 max-w-[140px] truncate">
                          {a.id}
                        </td>
                        <td className="py-2 pr-4 align-top text-xs text-zinc-700">
                          {a.created_at
                            ? new Date(a.created_at).toLocaleString("sv-SE")
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 align-top text-xs text-zinc-500">
                          {a.user_id ?? "okänd / null"}
                        </td>
                        <td className="py-2 pr-4 align-top text-xs text-zinc-700">
                          {a.recommended_label
                            ? `${a.recommended_label} (${a.recommended_ad_id ?? "?"})`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
