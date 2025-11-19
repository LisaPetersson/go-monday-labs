// app/annonsanalys/components/HelpModal.tsx
import React from 'react'

type Props = {
  open: boolean
  onClose: () => void
}

const HelpModal: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null

  return (
    <div
      className="pref-modal-overlay is-open"
      aria-hidden={!open}
    >
      <div
        className="pref-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        <div className="modal-header">
          <h2 id="help-modal-title">Så funkar annonsanalysen</h2>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modal-body help-modal-body">
          <section className="help-section">
            <p>
              Annonsanalysen hjälper dig att förstå vad olika
              jobbannonser egentligen säger – och vilken roll som
              verkar passa dig bäst.
            </p>
          </section>

          <section className="help-section">
            <h3>Vad tjänsten gör</h3>
            <p>Du klistrar in minst två jobbannonser.</p>
            <p>
              AI:n läser annonserna och skapar en strukturerad analys
              av innehåll, krav, arbetsuppgifter, kultur och
              utvecklingsmöjligheter.
            </p>
            <p>
              Resultatet visas i flera delar: snabbanalys, jämförelse,
              fördjupning och ansökningstips.
            </p>
            <p>
              Vissa funktioner är märkta som pro-funktioner.
            </p>
          </section>

          <section className="help-section">
            <h3>Syfte</h3>
            <p>
              Göra det lättare att jämföra flera jobb samtidigt utan att
              drunkna i text.
            </p>
            <p>
              Hjälpa dig att se vilka tjänster som faktiskt matchar dina
              preferenser och din profil.
            </p>
            <p>
              Ge underlag när du ska välja vilka jobb du vill gå vidare
              med – och vad du ska lyfta i din ansökan.
            </p>
          </section>

          <section className="help-section">
            <h3>Så använder du verktyget</h3>
            <ol className="help-list">
              <li>
                Klistra in annonserna under &quot;Klistra in dina
                annonser&quot; – börja med Annons A och B.
              </li>
              <li>
                Klicka på Analysera &amp; jämför för att köra analysen.
              </li>
              <li>
                Läs Snabbanalys för en överblick per annons.
              </li>
              <li>
                Bläddra vidare ned på sidan för att se jämförelse,
                fördjupad analys och ansökningstips.
              </li>
              <li>
                Om preferensfrågor finns kan du svara på dem
                (pro-läge) för att få en tydligare rekommendation.
              </li>
            </ol>
          </section>

          <p className="help-note">
            Kom ihåg att analysen är AI-stödd och kan missa detaljer.
            Använd den som beslutsstöd – inte som facit.
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
          >
            Jag förstår
          </button>
        </div>
      </div>
    </div>
  )
}

export default HelpModal
