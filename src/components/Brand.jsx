import logo from '../assets/scoreit-logo-light.png';

// The product's mark for every banner: the logo, then who it is by.
export default function Brand() {
  return (
    <span className="brand-banner">
      <img className="brand-logo" src={logo} alt="ScoreIt" />
      <span className="brand-by">by Z2HxRealSolutions</span>
    </span>
  );
}
