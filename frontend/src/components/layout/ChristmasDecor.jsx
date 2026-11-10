import './christmas.css';

// Fixed, deterministic particles: no timers, animation loops or random re-renders.
const SNOWFLAKES = Array.from({ length: 64 }, (_, index) => ({
  left: `${(index * 37 + 3) % 100}%`,
  '--size': `${4 + index % 6}px`,
  '--duration': `${11 + index % 10}s`,
  '--delay': `${-((index * 0.618) % 1) * (11 + index % 10)}s`,
  '--drift': `${index % 2 ? -40 : 48}px`,
}));

function Snowman({ scarf = '#b84450' }) {
  return <svg viewBox="0 0 100 132" focusable="false">
    <ellipse cx="50" cy="125" rx="43" ry="5" fill="#608f85" opacity=".15" />
    <path d="m25 79-19-17m8 7-1-12m62 22 19-17m-8 7 1-12" fill="none" stroke="#886e58" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="50" cy="97" rx="32" ry="29" fill="#eff8fa" stroke="#b4d3d7" />
    <ellipse cx="45" cy="91" rx="22" ry="21" fill="#fff" opacity=".8" />
    <circle cx="50" cy="51" r="23" fill="#f8fcff" stroke="#b4d3d7" />
    <path d="m30 32 4-23q16-7 32 0l4 23" fill="#264b46" />
    <path d="m32 23 36 0 2 9H30Z" fill={scarf} />
    <rect x="24" y="30" width="52" height="6" rx="3" fill="#264b46" />
    <circle cx="42" cy="47" r="2.2" fill="#264b46" />
    <circle cx="58" cy="47" r="2.2" fill="#264b46" />
    <ellipse cx="35" cy="56" rx="4" ry="2.5" fill="#efb9b8" opacity=".65" />
    <ellipse cx="65" cy="56" rx="4" ry="2.5" fill="#efb9b8" opacity=".65" />
    <path d="m49 51 15 4-15 3Z" fill="#eaa05a" />
    <path d="M43 62q7 5 14 0" fill="none" stroke="#456961" strokeWidth="1.6" strokeLinecap="round" />
    <path d="m65 72 4 23-11 2-4-24" fill={scarf} />
    <path d="M29 68q21 8 42 0l-1 10q-20 7-40 0Z" fill={scarf} />
    <path d="m59 90 9-2" stroke="#fff" strokeOpacity=".5" strokeWidth="2" />
    <circle cx="49" cy="89" r="2.5" fill="#456961" />
    <circle cx="49" cy="101" r="2.5" fill="#456961" />
    <circle cx="49" cy="113" r="2.5" fill="#456961" />
  </svg>;
}

export default function ChristmasDecor() {
  return <><div className="christmas-decor" aria-hidden="true">
    <div className="christmas-lights">
      {Array.from({ length: 24 }, (_, index) =>
        <span className="christmas-light" key={index} style={{ '--delay': `${-(index % 5)}s` }} />
      )}
    </div>
    <div className="christmas-snowmen"><Snowman /><span><Snowman scarf="#3b8071" /></span></div>
    <div className="christmas-snowmen snowmen-right"><Snowman scarf="#3b8071" /><span><Snowman /></span></div>
  </div>
    <div className="christmas-decor christmas-snow" aria-hidden="true">
      {SNOWFLAKES.map((style, index) => <span className="christmas-flake" key={index} style={style} />)}
    </div>
  </>;
}
