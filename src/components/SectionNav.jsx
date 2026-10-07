// Links to the sections of a long page. On a phone they scroll sideways and stay at the top.
function jump(id) {
  const el = document.getElementById(id);
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function SectionNav({ items }) {
  return (
    <nav className="section-nav" aria-label="On this page">
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="section-nav-btn" onClick={() => jump(item.id)}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
