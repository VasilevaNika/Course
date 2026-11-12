// Лёгкое конфетти на canvas без зависимостей. Уважает prefers-reduced-motion.

const COLORS = ['#4f46e5', '#818cf8', '#15803d', '#f59e0b', '#ec4899', '#06b6d4'];

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

type Particle = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string };

/** Залп конфетти. power: 1 — обычный, 2 — победа над боссом. */
export function confetti(power = 1): void {
  if (prefersReducedMotion() || typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.className = 'confetti-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const count = Math.round(70 * power);
  const parts: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Два залпа из нижних углов навстречу друг другу.
    const left = i % 2 === 0;
    const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
    const speed = (9 + Math.random() * 7) * Math.min(1.25, H / 700 + 0.4);
    parts.push({
      x: left ? W * 0.1 : W * 0.9,
      y: H + 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: COLORS[i % COLORS.length],
    });
  }

  const start = performance.now();
  const DURATION = 2200;
  function frame(t: number) {
    const elapsed = t - start;
    ctx!.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx!.restore();
    }
    if (elapsed < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
