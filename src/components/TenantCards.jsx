import { Link } from 'react-router-dom';

// One small picture for each card, drawn in the card's colour.
const ICONS = {
  divisions: (
    <path d="M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M8 17v4" />
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 10.8 15.8 7.2M8.2 13.2l7.6 3.6" />
    </>
  ),
  venue: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.5M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
    </>
  ),
  brand: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="8.5" cy="10" r="1.2" />
      <circle cx="12" cy="7.8" r="1.2" />
      <circle cx="15.5" cy="10" r="1.2" />
      <path d="M12 20.5c-1.8 0-2-1.5-1.2-2.4.8-1 .3-2.1-1-2.1H8" />
    </>
  ),
  advanced: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
};

function Icon({ name }) {
  return (
    <svg className="tcard-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// The first thing a tenant page shows: one card for each part, in plain words. A card opens that part.
// cards = [{ id, title, text, note }]
export default function TenantCards({ tenantId, cards }) {
  return (
    <ul className="tcard-grid">
      {cards.map((card) => (
        <li key={card.id}>
          <Link to={`/tenants/${tenantId}?section=${card.id}`} className="tcard">
            <Icon name={card.id} />
            <span className="tcard-title">{card.title}</span>
            <span className="tcard-text">{card.text}</span>
            {card.note && <span className="tcard-note">{card.note}</span>}
            <span className="tcard-open" aria-hidden="true">Open ›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
