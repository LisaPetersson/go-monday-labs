// app/annonsanalys/components/AdInputPanel.tsx
import React from 'react'

type Props = {
  ads: string[]
  canAnalyze: boolean
  loading: boolean
  error: string | null
  onChangeAd: (index: number, value: string) => void
  onAddAd: () => void
  onAnalyze: () => void
  onReset: () => void   // 👈 NY PROP
}

const AdInputPanel: React.FC<Props> = ({
  ads,
  canAnalyze,
  loading,
  error,
  onChangeAd,
  onAddAd,
  onAnalyze,
  onReset,
}) => {
  const labelForIndex = (index: number) => {
    if (index === 0) return 'Annons A'
    if (index === 1) return 'Annons B'
    const charCode = 'C'.charCodeAt(0) + (index - 2)
    return `Annons ${String.fromCharCode(charCode)}`
  }

  return (
    <div>
      <h2 className="section-heading">Klistra in dina annonser</h2>

      <div className="widget">
        <div className="widget-header">
          <h3>Lägg in dina annonser</h3>
        </div>
        <div className="widget-body">
          <div className="ad-input-grid">
            {ads.map((value, index) => (
              <div key={index} className="ad-input-col">
                <label
                  htmlFor={`ad-${index}`}
                  className="field-label"
                >
                  {labelForIndex(index)}
                </label>
                <textarea
                  id={`ad-${index}`}
                  className="gm-textarea ad-textarea"
                  placeholder={`Klistra in hela texten för ${labelForIndex(
                    index
                  )}…`}
                  value={value}
                  onChange={(e) => onChangeAd(index, e.target.value)}
                />
              </div>
            ))}

            {/* "+"-ruta (Pro-funktion) */}
            <button
              type="button"
              className="ad-add-card"
              onClick={onAddAd}
              title="Pro-funktion. Uppgradera ditt konto"
            >
              <span className="lock-icon" aria-hidden="true">
                🔒
              </span>
              <span className="ad-add-icon">＋</span>
              <span className="ad-add-text">Lägg till annons</span>
            </button>
          </div>

          <div className="analyze-row">
            <button
              type="button"
              className={`btn primary ${loading ? 'is-loading' : ''}`}
              onClick={onAnalyze}
              disabled={!canAnalyze || loading}
            >
              {loading ? 'Analyserar annonser…' : 'Analysera & jämför'}
            </button>

            {/* 👇 Ny Rensa-knapp bredvid analysera */}
            <button
              type="button"
              className="btn secondary"
              onClick={onReset}
              disabled={loading}
            >
              Rensa
            </button>

            {!canAnalyze && (
              <span className="hint-text">
                Minst Annons A och Annons B måste vara ifyllda.
              </span>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    </div>
  )
}

export default AdInputPanel
