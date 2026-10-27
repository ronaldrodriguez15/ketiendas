import { useEffect } from "react";

// Interaction tuning only. Background drift and parallax are intentionally independent.
export const LIQUID_CONFIG = {
  hover: { displacement: .6, rotation: .1, minScale: .998, maxScale: 1.004, largeSurfaceFactor: .5 },
  spring: { stiffness: 120, damping: 26 },
  border: { amplitude: .75, duration: 6500, opacity: .12 },
  click: { pressedScale: .996, duration: 220, stops: [[.28, 1.003], [.53, .999], [.76, 1.001], [1, 1]] },
  ripple: { opacity: .08, sizeFactor: .8, duration: 450 },
  highlight: { opacity: .12, softOpacity: .025, darkOpacity: .04, shadow: "0 10px 30px rgba(16,100,55,.1),inset 0 1px 0 rgba(255,255,255,.65)" },
  refraction: { scale: 1.5, speed: .25, baseX: .012, baseY: .025, amplitudeX: .003, amplitudeY: .004, ySpeedFactor: .7 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEYS = ["--tx", "--ty", "--sx", "--sy", "--rot"];
const neutral = [0, 0, 1, 1, 0];

// One delegated controller and one RAF for springs, parallax and refraction.
export default function useLiquidGlass() {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const hover = matchMedia("(hover: hover)");
    const root = document.documentElement;
    const config = LIQUID_CONFIG;
    // CSS effects share the same configuration; publish once, never per frame.
    const cssConfig = {
      "--liquid-border-amplitude": `${config.border.amplitude}px`,
      "--liquid-border-duration": `${config.border.duration}ms`,
      "--liquid-border-opacity": config.border.opacity,
      "--liquid-ripple-opacity": config.ripple.opacity,
      "--liquid-ripple-duration": `${config.ripple.duration}ms`,
      "--liquid-highlight-opacity": config.highlight.opacity,
      "--liquid-highlight-soft": config.highlight.softOpacity,
      "--liquid-highlight-dark": config.highlight.darkOpacity,
      "--liquid-hover-shadow": config.highlight.shadow,
    };
    Object.entries(cssConfig).forEach(([key, value]) => root.style.setProperty(key, value));
    // Syntax support alone does not guarantee SVG backdrop rendering.
    const refracts = /(?:Chrome|Chromium|Edg)\//.test(navigator.userAgent) && Boolean(window.CSS?.supports("backdrop-filter", "url(#liquid)"));
    root.classList.toggle("liquid-refraction", refracts);
    const states = new Map(), ripples = new Map();
    let active = null, pressed = null, pointerId = null, pointer = null, previous = null;
    let frame = 0, lastTime = 0, dirty = false, background = null;
    let refraction = 0, noiseTime = Math.PI / config.refraction.speed, filterTime = 0, waterNode = null;
    const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
    const turbulence = document.querySelector("#liquid feTurbulence");
    const displacement = document.querySelector("#liquid feDisplacementMap");
    const surfaceAt = (target) => {
      if (!(target instanceof Element) || target.closest('table, :disabled, [aria-disabled="true"]')) return null;
      const surface = target.closest('[data-liquid]');
      return surface?.querySelector('table') ? null : surface;
    };
    const stateFor = (node) => {
      if (!states.has(node)) states.set(node, { value: [...neutral], velocity: [0, 0, 0, 0, 0], target: [...neutral], release: null,
        factor: node.matches(".glass, .liquid-key") ? config.hover.largeSurfaceFactor : 1 });
      return states.get(node);
    };
    const wake = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(tick); };
    const setActive = (node) => {
      if (node === active) return;
      if (active) { active.classList.remove("liquid-hover"); stateFor(active).target = [...neutral]; }
      active = node;
      if (node) { node.classList.add("liquid-hover"); stateFor(node); }
      previous = null;
      wake();
    };
    function tick(time) {
      frame = 0;
      const dt = Math.min((time - (lastTime || time - 16.67)) / 1000, .032);
      lastTime = time;
      let running = false;
      if (!background?.isConnected) background = document.querySelector(".bgfx-parallax");
      // Read geometry only on input, before writing any styles.
      if (active && pointer && dirty && active.isConnected) {
        const rect = active.getBoundingClientRect();
        const x = clamp(pointer.x - rect.left, 0, rect.width), y = clamp(pointer.y - rect.top, 0, rect.height);
        const nx = x / Math.max(rect.width, 1) * 2 - 1, ny = y / Math.max(rect.height, 1) * 2 - 1;
        const elapsed = previous ? Math.max(pointer.time - previous.time, 8) : 16;
        const vx = previous ? (pointer.x - previous.x) / elapsed : 0, vy = previous ? (pointer.y - previous.y) / elapsed : 0;
        const stretch = clamp(Math.hypot(vx, vy) / 2, 0, 1), horizontal = Math.abs(vx) >= Math.abs(vy);
        const state = stateFor(active);
        const distance = config.hover.displacement * state.factor / Math.max(1, Math.hypot(nx, ny));
        const expansion = config.hover.maxScale - 1, compression = config.hover.minScale - 1;
        state.target = [nx * distance, ny * distance, 1 + (horizontal ? expansion : compression) * stretch,
          1 + (horizontal ? compression : expansion) * stretch, nx * config.hover.rotation * state.factor];
        active.style.setProperty("--mx", `${x}px`);
        active.style.setProperty("--my", `${y}px`);
        previous = pointer;
        dirty = false;
      }
      for (const [node, state] of states) {
        if (!node.isConnected) { states.delete(node); if (active === node) active = null; if (pressed === node) pressed = null; continue; }
        if (!pointer || time - pointer.time > 60) state.target[2] = state.target[3] = 1;
        let unsettled = false;
        // Four small semi-implicit Euler steps stabilize slow frames.
        for (let step = 0; step < 4; step++) for (let i = 0; i < 5; i++) {
          state.velocity[i] += (config.spring.stiffness * (state.target[i] - state.value[i]) - config.spring.damping * state.velocity[i]) * dt / 4;
          state.value[i] += state.velocity[i] * dt / 4;
        }
        let gel = 1;
        if (pressed === node) gel = config.click.pressedScale;
        else if (state.release !== null) {
          const progress = (time - state.release) / config.click.duration;
          const stops = [[0, config.click.pressedScale], ...config.click.stops];
          if (progress >= 1) state.release = null;
          else {
            const index = stops.findIndex(([at]) => at > progress);
            const [a, start] = stops[Math.max(0, index - 1)], [b, end] = stops[Math.max(1, index)];
            const mix = (1 - Math.cos(Math.PI * clamp((progress - a) / (b - a), 0, 1))) / 2;
            gel = start + (end - start) * mix;
            unsettled = true;
          }
        }
        const distanceLimit = config.hover.displacement * state.factor;
        const distanceRatio = Math.min(1, distanceLimit / (Math.hypot(state.value[0], state.value[1]) || 1));
        state.value.forEach((value, i) => {
          const moving = Math.abs(state.target[i] - value) > .0005 || Math.abs(state.velocity[i]) > .002;
          unsettled ||= moving;
          if (!moving) { state.value[i] = state.target[i]; state.velocity[i] = 0; }
          // Do not multiply click and hover scales: their combination would exceed the 1.5% limit.
          const output = i === 2 || i === 3
            ? (pressed === node || state.release !== null ? gel : clamp(state.value[i], config.hover.minScale, config.hover.maxScale))
            : i === 4 ? clamp(state.value[i], -config.hover.rotation * state.factor, config.hover.rotation * state.factor)
              : state.value[i] * distanceRatio;
          node.style.setProperty(KEYS[i], `${output.toFixed(4)}${i < 2 ? "px" : i === 4 ? "deg" : ""}`);
        });
        running ||= unsettled;
        if (!unsettled && node !== active && node !== pressed) { KEYS.forEach((key) => node.style.removeProperty(key)); states.delete(node); }
      }
      const follow = 1 - Math.exp(-7 * dt);
      parallax.x += (parallax.tx - parallax.x) * follow;
      parallax.y += (parallax.ty - parallax.y) * follow;
      background?.style.setProperty("--px", `${parallax.x.toFixed(3)}px`);
      background?.style.setProperty("--py", `${parallax.y.toFixed(3)}px`);
      running ||= Math.abs(parallax.tx - parallax.x) + Math.abs(parallax.ty - parallax.y) > .02;
      const waterActive = refracts && !reduced.matches && active?.matches(".liquid-key, .btn");
      if (waterActive && waterNode !== active) {
        waterNode?.classList.remove("liquid-water");
        waterNode = active;
        waterNode.classList.add("liquid-water");
      }
      refraction += ((waterActive ? config.refraction.scale : 0) - refraction) * follow;
      if (refracts && (waterActive || refraction > .02)) {
        noiseTime += dt;
        if (time - filterTime > 32) {
          const water = config.refraction;
          const phase = noiseTime * water.speed;
          // Derivative bounds: amplitudeX*speed=.00075/s, amplitudeY*speed*ySpeedFactor=.0007/s.
          turbulence?.setAttribute("baseFrequency", `${water.baseX + Math.sin(phase) * water.amplitudeX} ${water.baseY + Math.cos(phase * water.ySpeedFactor) * water.amplitudeY}`);
          // Change integer seeds at zero displacement to prevent visual jumps.
          turbulence?.setAttribute("seed", String(7 + Math.floor(phase / (2 * Math.PI))));
          displacement?.setAttribute("scale", String(refraction * (1 - Math.cos(phase)) / 2));
          filterTime = time;
        }
        running = true;
      } else {
        displacement?.setAttribute("scale", "0");
        waterNode?.classList.remove("liquid-water");
        waterNode = null;
      }
      if (running) wake(); else lastTime = 0;
    }
    const track = (event) => {
      if (reduced.matches || !hover.matches || event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY, time: performance.now() };
      dirty = true;
      parallax.tx = (pointer.x / window.innerWidth - .5) * 8;
      parallax.ty = (pointer.y / window.innerHeight - .5) * 8;
      setActive(surfaceAt(event.target));
      wake();
    };
    const leave = (event) => {
      if (reduced.matches || event.pointerType === "touch") return;
      setActive(surfaceAt(event.relatedTarget));
      if (!event.relatedTarget) { parallax.tx = parallax.ty = 0; wake(); }
    };
    const removeRipple = (layer) => { clearTimeout(ripples.get(layer)); ripples.delete(layer); layer.remove(); };
    const ripple = (node, event, keyboard = false) => {
      const rect = node.getBoundingClientRect();
      const x = keyboard ? rect.width / 2 : (event.clientX - rect.left) * node.offsetWidth / rect.width;
      const y = keyboard ? rect.height / 2 : (event.clientY - rect.top) * node.offsetHeight / rect.height;
      const size = Math.min(node.offsetWidth, node.offsetHeight) * config.ripple.sizeFactor;
      for (const layer of ripples.keys()) if (layer.parentElement === node) removeRipple(layer);
      const layer = document.createElement("span"), wave = document.createElement("span");
      layer.className = "liquid-ripple-layer";
      layer.setAttribute("aria-hidden", "true");
      wave.className = "liquid-ripple";
      wave.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
      layer.append(wave); node.append(layer);
      ripples.set(layer, setTimeout(() => removeRipple(layer), config.ripple.duration + 50));
    };
    const press = (event) => {
      if (reduced.matches || event.button !== 0 || !event.isPrimary) return;
      const node = surfaceAt(event.target), control = event.target.closest("input, textarea, select, button, a");
      if (!node || (control && control !== node)) return;
      if (event.pointerType === "touch") setActive(null);
      pressed = node; pointerId = event.pointerId;
      stateFor(node).release = null;
      ripple(node, event); wake();
    };
    const release = (event) => {
      if (!pressed || event.pointerId !== pointerId) return;
      stateFor(pressed).release = performance.now(); pressed = pointerId = null; wake();
    };
    const keyboardClick = (event) => {
      if (event.detail !== 0 || reduced.matches) return;
      const node = surfaceAt(event.target);
      if (!node?.matches("button,a")) return;
      ripple(node, event, true); stateFor(node).release = performance.now(); wake();
    };
    const reset = () => {
      cancelAnimationFrame(frame); frame = lastTime = 0;
      active?.classList.remove("liquid-hover");
      waterNode?.classList.remove("liquid-water"); waterNode = null;
      for (const node of states.keys()) KEYS.forEach((key) => node.style.removeProperty(key));
      states.clear();
      for (const layer of ripples.keys()) removeRipple(layer);
      active = pressed = pointerId = pointer = previous = null;
      parallax.x = parallax.y = parallax.tx = parallax.ty = refraction = 0;
      background?.style.removeProperty("--px"); background?.style.removeProperty("--py");
      displacement?.setAttribute("scale", "0");
    };
    const invalidate = () => { setActive(null); pointer = null; parallax.tx = parallax.ty = 0; wake(); };
    const events = { pointermove: track, pointerenter: track, pointerleave: leave, pointerdown: press,
      pointerup: release, pointercancel: release, click: keyboardClick, scroll: invalidate, visibilitychange: reset };
    // Enter/leave do not bubble: capture delegates them too, including routed views.
    Object.entries(events).forEach(([name, handler]) => document.addEventListener(name, handler, { capture: true, passive: true }));
    window.addEventListener("blur", reset); window.addEventListener("resize", invalidate);
    reduced.addEventListener("change", reset); hover.addEventListener("change", reset);
    return () => {
      reset(); root.classList.remove("liquid-refraction");
      Object.keys(cssConfig).forEach((key) => root.style.removeProperty(key));
      Object.entries(events).forEach(([name, handler]) => document.removeEventListener(name, handler, true));
      window.removeEventListener("blur", reset); window.removeEventListener("resize", invalidate);
      reduced.removeEventListener("change", reset); hover.removeEventListener("change", reset);
    };
  }, []);
}
