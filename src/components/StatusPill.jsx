const STATUS_META = {
  active: { label: 'Active', className: 'status-pill-active' },
  suspended: { label: 'Suspended', className: 'status-pill-suspended' },
  blocked: { label: 'Blocked', className: 'status-pill-blocked' },
  draft: { label: 'Draft', className: 'status-pill-suspended' },
  completed: { label: 'Completed', className: 'status-pill-suspended' },
};

export default function StatusPill({ status }) {
  const meta = STATUS_META[status] ?? { label: status, className: '' };
  return (
    <span className={`status-pill ${meta.className}`}>
      <span className="status-pill-dot" />
      {meta.label}
    </span>
  );
}
