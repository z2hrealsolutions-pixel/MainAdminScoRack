import logo from '../assets/scoreit-logo-light.png';

// The product's mark for every top banner: the logo, then who built it.
export default function Brand() {
  return (
    <span className="brand-banner">
      <img className="brand-logo" src={logo} alt="ScoreIt" />
      <span className="brand-x" aria-hidden="true">x</span>
      <span className="brand-by">Developed by Z2HxRealSolutions</span>
    </span>
  );
}
