export default function LiquidGlassFilter() {
  return (
    <svg className="liquid-filter" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <filter id="liquid" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.025" numOctaves="1" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
