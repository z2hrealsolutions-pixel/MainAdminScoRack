import { brandVars, normalizeHex } from '../lib/brandTheme';
import logoForDark from '../assets/scoreit-logo-light.png';
import logoForLight from '../assets/scoreit-logo.png';

const DEFAULT_PRIMARY = '#0097b2';

// the surfaces of each theme as the live and referee apps show them
const SURFACE = {
  dark: { '--bp-page': '#132030', '--bp-bar': '#172431', '--bp-tile': '#20313f', '--bp-paper': '#f2f5f8', '--bp-mist': '#aab9c7', '--bp-line': '#3b5164', '--bp-plate': '#ffffff' },
  light: { '--bp-page': '#e9f1f6', '--bp-bar': '#ffffff', '--bp-tile': '#ffffff', '--bp-paper': '#12202b', '--bp-mist': '#4a5d6e', '--bp-line': '#d3dde6', '--bp-plate': '#ffffff' },
};

function Frame({ theme, name, logoUrl, bannerUrl, colours }) {
  const vars = { ...SURFACE[theme], ...brandVars({ primary: colours.primary || DEFAULT_PRIMARY, accent: colours.accent }, theme) };
  if (!colours.accent) {
    vars['--brand-accent'] = vars['--lamp'];
  }
  return (
    <div className={`bp-frame bp-${theme}`} style={vars} aria-label={`${theme} theme preview`}>
      <div className="bp-bar" style={colours.accent ? { borderBottomColor: 'var(--brand-accent)' } : undefined}>
        <span className="bp-name">
          {logoUrl && (
            <span className="bp-plate">
              <img src={logoUrl} alt="" />
            </span>
          )}
          <span className="bp-name-text">{name}</span>
        </span>
        <img className="bp-scoreit" src={theme === 'dark' ? logoForDark : logoForLight} alt="ScoreIt" />
      </div>
      <div className="bp-body">
        {bannerUrl && <img className="bp-banner" src={bannerUrl} alt="" />}
        <div className="bp-tile">
          <div className="bp-tile-head">
            <span className="bp-live">Live</span>
            <span className="bp-muted">Court 1</span>
          </div>
          <div className="bp-score-row">
            <span>Team One</span>
            <span className="bp-score">11</span>
          </div>
          <div className="bp-score-row">
            <span>Team Two</span>
            <span className="bp-score bp-score-dim">8</span>
          </div>
          <div className="bp-actions">
            <span className="bp-button">Open</span>
            <span className="bp-link">See the standings</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// how the live page will look in both themes, with the colours already made readable
export default function BrandPreview({ name, logoUrl, bannerUrl, primary, accent }) {
  const colours = { primary: normalizeHex(primary), accent: normalizeHex(accent) };
  return (
    <div className="bp-pair">
      <Frame theme="dark" name={name} logoUrl={logoUrl} bannerUrl={bannerUrl} colours={colours} />
      <Frame theme="light" name={name} logoUrl={logoUrl} bannerUrl={bannerUrl} colours={colours} />
    </div>
  );
}
