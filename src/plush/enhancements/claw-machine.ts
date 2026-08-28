import type { Cleanup } from "../types";

interface Toy {
  el: HTMLDivElement;
  lane: number;
  grabbed: boolean;
}

const LANES = [10, 24, 38, 52, 66] as const;
const CHUTE_LANE = 84;
const TOY_EMOJIS = ["🐱", "🐰", "🐻", "🤖", "⚙️", "🎀"];
const GRAB_CHANCE = 0.7;
const FLOOR_Y = 340;

export function mountClawMachine(): Cleanup {
  const home = document.getElementById("page-home");
  if (!home) return () => {};

  const section = document.createElement("section");
  section.className = "playground-section";
  section.innerHTML = `
    <div class="wrap">
      <div class="ruled-title center"><div class="rule"></div><h2>claw machine</h2><div class="rule"></div></div>
      <p class="playground-hint">move the claw · hit drop · keep what you grab 🧸</p>
      <div class="claw-prize-counter">🏆 prizes won: <span id="clawPrizeCount">0</span></div>
      <div class="playground-arena" id="claw-arena">
        <div class="claw-rail"></div>
        <div class="claw-rig" id="claw-rig">
          <div class="claw-rope"></div>
          <div class="claw-head">
            <div class="claw-prong claw-prong-l"></div>
            <div class="claw-prong claw-prong-r"></div>
          </div>
        </div>
        <div class="claw-chute"></div>
      </div>
      <div class="playground-controls">
        <button class="playground-btn" type="button" data-action="left">◀ left</button>
        <button class="playground-btn playground-btn-drop" type="button" data-action="drop">drop ⬇</button>
        <button class="playground-btn" type="button" data-action="right">right ▶</button>
      </div>
    </div>`;

  const joinSection = home.querySelector(".join-section");
  home.insertBefore(section, joinSection);

  const arena = section.querySelector<HTMLDivElement>("#claw-arena");
  const rig = section.querySelector<HTMLDivElement>("#claw-rig");
  const prizeCountEl = section.querySelector<HTMLSpanElement>("#clawPrizeCount");
  const leftBtn = section.querySelector<HTMLButtonElement>('[data-action="left"]');
  const rightBtn = section.querySelector<HTMLButtonElement>('[data-action="right"]');
  const dropBtn = section.querySelector<HTMLButtonElement>('[data-action="drop"]');

  if (!arena || !rig || !prizeCountEl || !leftBtn || !rightBtn || !dropBtn) {
    section.remove();
    return () => {};
  }

  const timers: number[] = [];
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      timers.push(window.setTimeout(resolve, ms));
    });

  const toys: Toy[] = [];
  let laneIndex = 0;
  let prizeCount = 0;
  let busy = false;

  const setLaneX = (lane: number, x: number) => {
    void lane;
    rig.style.left = `${x}%`;
  };

  const spawnToy = (lane: number, animate: boolean) => {
    const el = document.createElement("div");
    el.className = "claw-toy";
    if (animate) el.classList.add("spawn-in");
    el.textContent = TOY_EMOJIS[(Math.random() * TOY_EMOJIS.length) | 0];
    el.style.left = `${LANES[lane]}%`;
    el.style.top = `${FLOOR_Y}px`;
    el.style.transform = "translateX(-50%)";
    arena.appendChild(el);
    toys.push({ el, lane, grabbed: false });
  };

  const emptyLanes = () => LANES.map((_, i) => i).filter((i) => !toys.some((t) => t.lane === i));

  for (let i = 0; i < LANES.length; i++) spawnToy(i, false);
  setLaneX(laneIndex, LANES[laneIndex]);

  const setControlsEnabled = (enabled: boolean) => {
    leftBtn.disabled = !enabled;
    rightBtn.disabled = !enabled;
    dropBtn.disabled = !enabled;
  };

  const moveLane = (dir: -1 | 1) => {
    if (busy) return;
    laneIndex = Math.min(LANES.length - 1, Math.max(0, laneIndex + dir));
    setLaneX(laneIndex, LANES[laneIndex]);
  };

  const runDropSequence = async () => {
    if (busy) return;
    busy = true;
    setControlsEnabled(false);

    rig.classList.add("dropping");
    await wait(600);

    const targetX = LANES[laneIndex];
    const nearest = toys
      .filter((t) => !t.grabbed)
      .reduce<Toy | null>((closest, t) => {
        const dist = Math.abs(LANES[t.lane] - targetX);
        if (!closest) return dist < 6 ? t : null;
        return dist < Math.abs(LANES[closest.lane] - targetX) ? t : closest;
      }, null);

    const success = nearest !== null && Math.random() < GRAB_CHANCE;
    let won: Toy | null = null;

    if (success && nearest) {
      won = nearest;
      won.grabbed = true;
      rig.classList.add("gripping");
      won.el.style.top = `${FLOOR_Y - 210}px`;
      won.el.style.left = `${targetX}%`;
    } else {
      rig.classList.add("gripping");
    }
    await wait(250);

    rig.classList.remove("dropping");
    await wait(550);

    if (won) {
      won.el.style.left = `${CHUTE_LANE}%`;
    }
    laneIndex = LANES.length - 1;
    setLaneX(laneIndex, CHUTE_LANE);
    await wait(500);

    rig.classList.remove("gripping");

    if (won) {
      won.el.classList.add("won");
      prizeCount++;
      prizeCountEl.textContent = String(prizeCount);
      const wonToy = won;
      await wait(350);
      toys.splice(toys.indexOf(wonToy), 1);
      wonToy.el.remove();

      const free = emptyLanes();
      if (free.length > 0) {
        const lane = free[(Math.random() * free.length) | 0];
        spawnToy(lane, true);
      }
    }

    busy = false;
    setControlsEnabled(true);
  };

  const onControlClick = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".playground-btn");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "left") moveLane(-1);
    else if (action === "right") moveLane(1);
    else if (action === "drop") void runDropSequence();
  };

  section.addEventListener("click", onControlClick);

  return () => {
    timers.forEach((id) => window.clearTimeout(id));
    section.removeEventListener("click", onControlClick);
    section.remove();
  };
}
