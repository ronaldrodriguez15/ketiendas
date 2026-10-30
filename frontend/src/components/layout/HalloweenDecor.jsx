import './halloween.css';

function Bat() {
  return <svg viewBox="0 0 100 46" fill="currentColor" focusable="false">
    <path className="halloween-wing left" d="M47 23C34 8 17 15 3 2c1 18 7 28 16 31 1-7 7-9 12-2 4-7 10-7 16 0Z" />
    <path className="halloween-wing right" d="M53 23C66 8 83 15 97 2c-1 18-7 28-16 31-1-7-7-9-12-2-4-7-10-7-16 0Z" />
    <path d="m43 18-2-12 9 7 9-7-2 12c8 12 1 22-7 26-8-4-15-14-7-26Z" />
    <path d="M45 22h3m4 0h3" stroke="#f7c883" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

function Pumpkin() {
  return <svg viewBox="0 0 100 92" focusable="false">
    <path d="M48 21Q43 8 55 4l6 4q-12 3-8 14" fill="#476844" />
    <path d="M54 18q20-13 27-1-17 9-27 1" fill="#72934f" />
    <ellipse cx="50" cy="85" rx="38" ry="5" fill="#5d391f" opacity=".12" />
    <ellipse cx="29" cy="52" rx="23" ry="31" fill="#d97833" />
    <ellipse cx="71" cy="52" rx="23" ry="31" fill="#d97833" />
    <ellipse cx="39" cy="53" rx="22" ry="33" fill="#e99242" />
    <ellipse cx="61" cy="53" rx="22" ry="33" fill="#e99242" />
    <ellipse cx="50" cy="53" rx="18" ry="34" fill="#f3a653" />
    <path d="m25 47 13-8 3 13Zm50 0-13-8-3 13ZM45 59l5-7 5 7ZM29 63q21 24 42 0l-12 4-2 6-8-1-2-5-9 1Z" fill="#613c2b" />
    <path d="m28 46 9-5m35 5-9-5" stroke="#ffdb8e" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

// Decoration is isolated from the app's layout and never receives pointer events.
export default function HalloweenDecor() {
  return <div className="halloween-decor" aria-hidden="true">
    <div className="halloween-flight flight-one"><Bat /></div>
    <div className="halloween-flight flight-two"><Bat /></div>
    <div className="halloween-flight flight-three"><Bat /></div>
    <div className="halloween-flight flight-four"><Bat /></div>
    <div className="halloween-flight flight-five"><Bat /></div>
    <div className="halloween-flight flight-six"><Bat /></div>
    <div className="halloween-pumpkins"><Pumpkin /><span><Pumpkin /></span></div>
    <div className="halloween-pumpkins pumpkins-right"><Pumpkin /><span><Pumpkin /></span></div>
    <div className="halloween-pumpkins pumpkins-top"><Pumpkin /></div>
    <div className="halloween-spark spark-one">✦</div>
    <div className="halloween-spark spark-two">✧</div>
    <div className="halloween-spark spark-three">✦</div>
    <div className="halloween-spark spark-four">✧</div>
    <div className="halloween-spark spark-five">✦</div>
    <div className="halloween-spark spark-six">✧</div>
  </div>;
}
