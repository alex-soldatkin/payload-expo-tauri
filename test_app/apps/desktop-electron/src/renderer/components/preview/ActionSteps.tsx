// Promise-based modal steps for action handlers: a registered bulk/edit action
// can be a one-shot server call or an elaborate multi-step flow — fetch
// related data, show it, collect input, confirm — by awaiting these steps
// sequentially. One modal at a time; resolving unblocks the handler.
import { createContext, useCallback, useContext, useRef, useState } from 'react'

export type StepField = {
  name: string
  label: string
  type?: 'text' | 'select'
  options?: Array<{ label: string; value: string }>
}

export type ActionSteps = {
  /** Confirmation step — resolves true/false. */
  confirmStep: (opts: { title: string; body?: string; confirmLabel?: string }) => Promise<boolean>
  /** Input step — resolves the values, or null when cancelled. */
  formStep: (opts: { title: string; fields: StepField[] }) => Promise<Record<string, string> | null>
}

const noSteps: ActionSteps = {
  confirmStep: async ({ title, body }) => window.confirm(body ? `${title}\n\n${body}` : title),
  formStep: async () => null,
}

const StepsContext = createContext<ActionSteps>(noSteps)
export const useActionSteps = () => useContext(StepsContext)

type ActiveStep =
  | { kind: 'confirm'; title: string; body?: string; confirmLabel?: string; resolve: (v: boolean) => void }
  | { kind: 'form'; title: string; fields: StepField[]; resolve: (v: Record<string, string> | null) => void }

export function ActionStepsProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<ActiveStep | null>(null)
  const busy = useRef(false)

  const confirmStep = useCallback<ActionSteps['confirmStep']>((opts) => {
    if (busy.current) return Promise.resolve(false)
    busy.current = true
    return new Promise<boolean>((resolve) => {
      setStep({ kind: 'confirm', ...opts, resolve })
    }).finally(() => {
      busy.current = false
      setStep(null)
    })
  }, [])

  const formStep = useCallback<ActionSteps['formStep']>((opts) => {
    if (busy.current) return Promise.resolve(null)
    busy.current = true
    return new Promise<Record<string, string> | null>((resolve) => {
      setStep({ kind: 'form', ...opts, resolve })
    }).finally(() => {
      busy.current = false
      setStep(null)
    })
  }, [])

  return (
    <StepsContext.Provider value={{ confirmStep, formStep }}>
      {children}
      {step && <StepModal step={step} />}
    </StepsContext.Provider>
  )
}

function StepModal({ step }: { step: ActiveStep }) {
  const [values, setValues] = useState<Record<string, string>>({})

  return (
    <div className="peek-overlay" onMouseDown={() => (step.kind === 'confirm' ? step.resolve(false) : step.resolve(null))}>
      <div className="peek-card action-step" onMouseDown={(e) => e.stopPropagation()}>
        <div className="peek-head">
          <span className="peek-title">{step.title}</span>
        </div>
        <div className="peek-body">
          {step.kind === 'confirm' && step.body && (
            <div className="action-step-body">{step.body}</div>
          )}
          {step.kind === 'form' &&
            step.fields.map((f) => (
              <div key={f.name} className="field">
                <label className="field-label">{f.label}</label>
                {f.type === 'select' && f.options ? (
                  <select
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                  />
                )}
              </div>
            ))}
        </div>
        <div className="editor-actions">
          <button
            onClick={() => (step.kind === 'confirm' ? step.resolve(false) : step.resolve(null))}
          >
            Cancel
          </button>
          <div className="spacer" />
          <button
            className="primary"
            onClick={() => (step.kind === 'confirm' ? step.resolve(true) : step.resolve(values))}
          >
            {step.kind === 'confirm' ? step.confirmLabel ?? 'Confirm' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
