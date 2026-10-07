import logoForDark from '../assets/scoreit-logo-light.png';
import logoForLight from '../assets/scoreit-logo.png';

// The product's mark for every banner: the logo, then who it is by. There are two pictures of the
// logo, light lettering for the dark theme and dark lettering for the light one, and the theme shows one.
export default function Brand() {
  return (
    <span className="brand-banner">
      <img className="brand-logo brand-logo-on-dark" src={logoForDark} alt="ScoreIt" />
      <img className="brand-logo brand-logo-on-light" src={logoForLight} alt="" aria-hidden="true" />
      <span className="brand-by">by Z2HxRealSolutions</span>
    </span>
  );
}
