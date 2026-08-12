import type { Cleanup } from "../types";

interface Toy {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  grabbed: boolean;
  ox: number;
  oy: number;
}

export function mountPlayground(): Cleanup {
  const home = document.getElementById("page-home");
  if (!home) return () => {};

  const section = document.createElement("section");
  section.className = "playground-section";
  section.innerHTML = `
    <div class="wrap">
      <div class="ruled-title center"><div class="rule"></div><h2>plushie playground</h2><div class="rule"></div></div>
      <p class="playground-hint">grab a plushie · fling it · they always land soft ✨</p>
      <div class="playground-arena" id="plush-arena"></div>
      <div class="playground-controls">
        <button class="playground-btn" type="button" data-action="add">✨ add plushie</button>
        <button class="playground-btn" type="button" data-action="gravity">⬇ toggle gravity</button>
        <button class="playground-btn" type="button" data-action="explode">💥 shake it up</button>
        <button class="playground-btn" type="button" data-action="reset">↺ reset</button>
      </div>
    </div>`;

  const joinSection = home.querySelector(".join-section");
  home.insertBefore(section, joinSection);

  const arena = section.querySelector<HTMLDivElement>("#plush-arena");
  if (!arena) {
    section.remove();
    return () => {};
  }

  const emojis = ["🐱", "🐰", "🐻", "🤖", "💜", "💙", "💚", "⚙️", "🎀", "✨"];
  const toys: Toy[] = [];
  const gravity = 0.35;
  let gravityOn = true;

  const addToy = (x?: number, y?: number) => {
    const el = document.createElement("div");
    el.className = "plush-toy";
    el.textContent = emojis[(Math.random() * emojis.length) | 0];
    arena.appendChild(el);

    const radius = 34;
    const toy: Toy = {
      el,
      x: x ?? Math.random() * (arena.clientWidth - radius * 2) + radius,
      y: y ?? radius + Math.random() * 30,
      vx: (Math.random() - 0.5) * 4,
      vy: 0,
      r: radius,
      grabbed: false,
      ox: 0,
      oy: 0,
    };
    toys.push(toy);

    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;

    const onDown = (event: PointerEvent) => {
      toy.grabbed = true;
      toy.vx = 0;
      toy.vy = 0;
      el.classList.add("grabbed");
      el.setPointerCapture(event.pointerId);

      const rect = arena.getBoundingClientRect();
      toy.ox = event.clientX - rect.left - toy.x;
      toy.oy = event.clientY - rect.top - toy.y;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = performance.now();
    };

    const onMove = (event: PointerEvent) => {
      if (!toy.grabbed) return;

      const rect = arena.getBoundingClientRect();
      toy.x = event.clientX - rect.left - toy.ox;
      toy.y = event.clientY - rect.top - toy.oy;

      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      toy.vx = ((event.clientX - lastX) / dt) * 16;
      toy.vy = ((event.clientY - lastY) / dt) * 16;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = now;
    };

    const onUp = () => {
      if (!toy.grabbed) return;
      toy.grabbed = false;
      el.classList.remove("grabbed");
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  for (let i = 0; i < 7; i++) addToy();

  let raf = 0;
  const tick = () => {
    const width = arena.clientWidth;
    const height = arena.clientHeight;
    const bounce = 0.72;
    const friction = 0.995;
    const floorFriction = 0.86;

    for (const toy of toys) {
      if (!toy.grabbed) {
        if (gravityOn) toy.vy += gravity;
        toy.vx *= friction;
        toy.vy *= friction;
        toy.x += toy.vx;
        toy.y += toy.vy;

        if (toy.x < toy.r) {
          toy.x = toy.r;
          toy.vx = -toy.vx * bounce;
        }
        if (toy.x > width - toy.r) {
          toy.x = width - toy.r;
          toy.vx = -toy.vx * bounce;
        }
        if (toy.y < toy.r) {
          toy.y = toy.r;
          toy.vy = -toy.vy * bounce;
        }
        if (toy.y > height - toy.r) {
          toy.y = height - toy.r;
          toy.vy = -toy.vy * bounce;
          toy.vx *= floorFriction;
          if (Math.abs(toy.vy) < 0.6) toy.vy = 0;
        }
      }

      for (const other of toys) {
        if (other === toy) continue;

        const dx = other.x - toy.x;
        const dy = other.y - toy.y;
        const distance = Math.hypot(dx, dy);
        const minDistance = toy.r + other.r - 6;

        if (distance > 0 && distance < minDistance) {
          const push = (minDistance - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;

          if (!toy.grabbed) {
            toy.x -= nx * push;
            toy.y -= ny * push;
          }
          if (!other.grabbed) {
            other.x += nx * push;
            other.y += ny * push;
          }

          const relativeVelocity = (toy.vx - other.vx) * nx + (toy.vy - other.vy) * ny;
          if (relativeVelocity > 0) {
            toy.vx -= relativeVelocity * nx * 0.6;
            toy.vy -= relativeVelocity * ny * 0.6;
            other.vx += relativeVelocity * nx * 0.6;
            other.vy += relativeVelocity * ny * 0.6;
          }
        }
      }

      toy.el.style.transform = `translate(${toy.x - toy.r}px, ${toy.y - toy.r}px)`;
    }

    raf = requestAnimationFrame(tick);
  };

  tick();

  const onControlClick = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".playground-btn");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "add") addToy();
    else if (action === "gravity") gravityOn = !gravityOn;
    else if (action === "explode") {
      for (const toy of toys) {
        toy.vx += (Math.random() - 0.5) * 40;
        toy.vy += (Math.random() - 0.8) * 30;
      }
    } else if (action === "reset") {
      while (toys.length) toys.pop()!.el.remove();
      for (let i = 0; i < 7; i++) addToy();
    }
  };

  section.addEventListener("click", onControlClick);

  return () => {
    cancelAnimationFrame(raf);
    section.removeEventListener("click", onControlClick);
    section.remove();
  };
}
