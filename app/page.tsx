// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-xl mx-auto px-6 py-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 mb-4">
          Go Monday Labs
        </h1>

        <p className="text-zinc-600 mb-8">
          Utforska experimentella verktyg för smartare jobbsök – börja med att
          analysera dina jobbannonser, håll utkik efter vår kommande
         AI--kollen, eller kika på den interna dashboarden.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
          {/* Annonsanalysen */}
          <Link
            href="/annonsanalys"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-50 shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            Öppna annonsanalysen
          </Link>

          {/* AI-kollen (kommer snart) */}
          <button
            disabled
            aria-disabled="true"
            className="relative inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-200 px-4 py-3 text-sm font-medium text-zinc-500 shadow-sm cursor-not-allowed"
          >
            AI-kollen för CV
            <span className="absolute -top-2 right-3 rounded-full bg-yellow-300 text-[11px] font-medium px-2 py-0.5 text-zinc-900 shadow-sm">
              Kommer snart
            </span>
          </button>

          {/* Dashboard / adminportal */}
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-500 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            Dashboard (admin)
          </Link>
        </div>
      </div>
    </main>
  );
}
