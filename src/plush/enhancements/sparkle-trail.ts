import type { Cleanup } from "../types";

export function mountSparkleTrail(): Cleanup {
  const canvas = document.createElement("canvas");
  canvas.id = "plush-sparkle-canvas";
  // Purely decorative cursor-trail effect — keep it out of the a11y tree.
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return () => {};
  }

  const colors = ["#a8bede", "#bfa8d8", "#a4c9b0", "#ffffff"];
  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    c: string;
    s: number;
  };
  const particles: Particle[] = [];
  let lastSpawn = 0;

  const resize = () => {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(devicePixelRatio, devicePixelRatio);
  };

  resize();

  const onMove = (event: MouseEvent) => {
    const now = performance.now();
    if (now - lastSpawn < 22) return;
    lastSpawn = now;

    for (let i = 0; i < 2; i++) {
      particles.push({
        x: event.clientX,
        y: event.clientY,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7 - 0.3,
        life: 0,
        max: 40 + Math.random() * 30,
        c: colors[(Math.random() * colors.length) | 0],
        s: 1.5 + Math.random() * 2,
      });
    }
  };

  window.addEventListener("mousemove", onMove);
  window.addEventListener("resize", resize);

  let raf = 0;
  const tick = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life++;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.02;

      const alpha = 1 - particle.life / particle.max;
      if (alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = particle.c;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.s * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  };

  tick();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("resize", resize);
    canvas.remove();
  };
}
