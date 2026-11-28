import { computeSteps } from '../lib/divisionSteps';

// The path through a division as a strip of numbered steps. The current one is lit, finished ones carry a tick.
export function Stepper({ progress, active, onPick }) {
  const steps = computeSteps(progress);
  return (
    <nav className="stepper" aria-label="Steps for this division">
      <ol>
        {steps.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              className={`stepper-btn stepper-${step.state} ${active === step.id ? 'stepper-active' : ''}`}
              aria-current={active === step.id ? 'step' : undefined}
              onClick={() => onPick(step.id)}
            >
              <span className="stepper-dot" aria-hidden="true">{step.state === 'done' ? '✓' : step.number}</span>
              <span className="stepper-label">{step.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// What to do next, in one sentence and one button.
// A step with an `action` does that thing itself (publish); the others take you to the step. `busy` stops double clicks.
export function NextUp({ next, onGo, onAct, busy }) {
  return (
    <div className="nextup" role="status">
      <div className="nextup-text">
        <span className="nextup-kicker">Next up</span>
        <strong className="nextup-title">{next.title}</strong>
        {next.text && <span className="nextup-hint">{next.text}</span>}
      </div>
      {next.button && (
        <button
          type="button"
          className="btn-primary nextup-btn"
          disabled={!!busy}
          onClick={() => (next.action && onAct ? onAct(next.action) : onGo(next.step))}
        >
          {busy ? 'Working…' : next.button}
        </button>
      )}
    </div>
  );
}
