export default function StatusControl({ options, current, onChange }) {
  return (
    <div className="status-options">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`status-option ${
            current === option.value ? 'status-option-active' : ''
          }`}
          onClick={() => onChange(option.value)}
          disabled={current === option.value}
        >
          <span className="status-option-label">{option.label}</span>
          <span className="status-option-hint">{option.hint}</span>
        </button>
      ))}
    </div>
  );
}
