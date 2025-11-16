// app/annonsanalys/components/PreferenceModal.tsx
// PreferenceModal.tsx – popup med frågor
import React from 'react'
import type { AiPreferenceQuestion } from '../ai/compareAds'

type Props = {
  open: boolean
  onClose: () => void
  questions: AiPreferenceQuestion[]
  answers: Record<string, string>
  onAnswerChange: (questionId: string, adId: string) => void
}

const PreferenceModal: React.FC<Props> = ({
  open,
  onClose,
  questions,
  answers,
  onAnswerChange,
}) => {
  if (!open) return null

  return (
    <div
      className={`pref-modal-overlay ${open ? 'is-open' : ''}`}
      aria-hidden={!open}
    >
      <div
        className="pref-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pref-modal-title"
      >
        <div className="modal-header">
          <h2 id="pref-modal-title">Vilken roll matchar dig bäst?</h2>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="pref-intro">
            Svara på de här frågorna så hjälper vi dig att se vilken roll
            som verkar passa dig bäst. När du stänger fönstret räknas
            dina svar samman och en rekommendation visas i analysen.
          </p>

          <div className="pref-questions-list">
            {questions.map((q) => (
              <div key={q.id} className="pref-question">
                <p className="pref-question-text">{q.text}</p>
                <div className="pref-options">
                  {q.options.map((opt) => (
                    <label
                      key={opt.id}
                      className="pref-option"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.adId}
                        checked={answers[q.id] === opt.adId}
                        onChange={() =>
                          onAnswerChange(q.id, opt.adId)
                        }
                      />
                      <span className="pref-option-label">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
          >
            Visa min rekommendation
          </button>
        </div>
      </div>
    </div>
  )
}

export default PreferenceModal
