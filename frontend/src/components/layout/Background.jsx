const BLOBS = [
  { size: 380, color: "#22c55e", top: "-8%", left: "-8%", duration: 36, delay: -4, x: 12, y: 10, rotation: 20 },
  { size: 420, color: "#4ade80", top: "65%", left: "75%", duration: 42, delay: -13, x: -14, y: -12, rotation: -24 },
  { size: 280, color: "#10b981", top: "30%", left: "55%", duration: 34, delay: -7, x: -10, y: 13, rotation: 30 },
  { size: 250, color: "#34d399", top: "65%", left: "10%", duration: 46, delay: -21, x: 14, y: -10, rotation: -20 },
  { size: 320, color: "#86efac", top: "-12%", left: "65%", duration: 40, delay: -17, x: -12, y: 14, rotation: 26 },
  { size: 230, color: "#22c55e", top: "38%", left: "-10%", duration: 32, delay: -11, x: 11, y: -9, rotation: -28 },
];

export default function Background({ children }) {
  return (
    <div className="app">
      <div className="bgfx" aria-hidden="true">
        <div className="bgfx-parallax">
          {BLOBS.map((b, i) => (
            <div key={i} className="blob" style={{ width: b.size, height: b.size, background: b.color,
              top: b.top, left: b.left, opacity: .7 + i * .03,
              "--duration": `${b.duration}s`, "--slow-duration": `${b.duration * 5}s`, "--delay": `${b.delay}s`,
              "--drift-x": `${b.x}vw`, "--drift-y": `${b.y}vh`, "--turn": `${b.rotation}deg`,
              "--quiet-x": `${b.x * .2}vw`, "--quiet-y": `${b.y * .2}vh`, "--quiet-turn": `${b.rotation * .2}deg`,
            }} />
          ))}
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
