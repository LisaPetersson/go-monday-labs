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
          Utforska experimentella verktyg för smartare jobbsök – börja med att analysera dina jobbannonser
          eller håll utkik efter vår kommande CV-skapare.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Aktiv knapp till annonsanalys */}
          <Link
            href="/annonsanalys"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-medium bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            Gå till annonsanalys
          </Link>

          {/* Inaktiv "CV-skaparen"-knapp */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="relative inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-medium bg-zinc-200 text-zinc-500 shadow-sm cursor-not-allowed"
          >
            CV-skaparen
            <span className="absolute -top-2 right-3 rounded-full bg-amber-300/90 text-[11px] font-medium px-2 py-0.5 text-zinc-900 shadow-sm">
              Kommer snart
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
