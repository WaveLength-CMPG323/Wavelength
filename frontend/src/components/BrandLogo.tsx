// Canonical Wavelength logo mark - the hand-drawn overlapping wave-strand
// illustration supplied by the team, replacing the old placeholder
// `OceanWaveIcon` glyph as the app's brand mark. Served as a plain <img>
// on a genuinely transparent background (wavelength-logo.png has its white
// background removed and is cropped to content, unlike the older
// wavelength-logo-source.png it replaces) with a small drop-shadow glow so
// it reads consistently against the app's dark ocean panels; the source
// blue is already close enough to the cyan/teal palette that no hue-shift
// filter was needed. No background box/padding container is needed around
// it since it has no opaque backing of its own anymore.
interface BrandLogoProps {
  className?: string;
  withWordmark?: boolean;
  // Extra classes applied to the "Wavelength" wordmark span itself (on top
  // of its own base classes below) - lets a caller hide it responsively
  // (e.g. `hidden sm:inline` in OceanNav, where a phone-width bar doesn't
  // have room for the logo + full wordmark + search + nav icons at once)
  // without having to reimplement the logo+wordmark markup itself.
  wordmarkClassName?: string;
}

export default function BrandLogo({ className = 'h-8 w-8', withWordmark = false, wordmarkClassName = '' }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src="/brand/wavelength-logo.png"
        alt="Wavelength"
        className={`${className} object-contain drop-shadow-[0_0_6px_rgba(34,211,238,0.45)]`}
      />
      {withWordmark && (
        <span className={`text-lg font-semibold tracking-tight text-wl-title ${wordmarkClassName}`}>Wavelength</span>
      )}
    </span>
  );
}
