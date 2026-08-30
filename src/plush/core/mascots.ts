import { MASCOTS } from "../data/mascots";
import type { Cleanup } from "../types";

function setArrowColor(color: string) {
  document.querySelectorAll<SVGPathElement>(".mascot-arrow svg path").forEach((path) => {
    path.setAttribute("stroke", color);
  });
}

export function mountMascots(): Cleanup {
  let currentMascot = 0;
  let transitioning = false;

  function renderMascot() {
    const mascot = MASCOTS[currentMascot];
    const svgEl = document.getElementById("mascotSvg");
    const groundEl = document.getElementById("mascotGround");
    const nameEl = document.getElementById("mascotName");
    const roleEl = document.getElementById("mascotRole");
    const factEl = document.getElementById("mascotFact");
    const glowEl = document.getElementById("mascotGlow");

    if (!svgEl || !groundEl || !nameEl || !roleEl || !factEl || !glowEl) return;

    svgEl.innerHTML = mascot.svg;
    groundEl.style.background = `radial-gradient(ellipse, ${mascot.ground} 0%, transparent 70%)`;
    nameEl.textContent = mascot.name;
    nameEl.style.color = mascot.color;
    roleEl.textContent = mascot.role;
    roleEl.style.display = mascot.role ? "" : "none";
    factEl.textContent = mascot.fact;
    factEl.style.borderColor = `${mascot.color}40`;
    glowEl.style.background = `radial-gradient(circle, ${mascot.color}55 0%, transparent 70%)`;
    setArrowColor(mascot.color);

    document.querySelectorAll<HTMLElement>(".mascot-dot").forEach((dot, index) => {
      dot.style.background = index === currentMascot ? mascot.color : "rgba(232,237,248,0.2)";
      dot.classList.toggle("active", index === currentMascot);
    });
  }

  const timers: number[] = [];

  function animateMascotChange(nextIndex: number) {
    if (nextIndex === currentMascot || transitioning) return;

    transitioning = true;
    const figure = document.getElementById("mascotFigure");
    const fact = document.getElementById("mascotFact");
    if (!figure || !fact) {
      transitioning = false;
      return;
    }

    const dir = nextIndex > currentMascot ? 1 : -1;
    figure.classList.add(dir < 0 ? "slide-out-left" : "slide-out-right");
    fact.style.opacity = "0";

    timers.push(
      window.setTimeout(() => {
        currentMascot = nextIndex;
        renderMascot();
        figure.classList.remove("slide-out-left", "slide-out-right");
        figure.classList.add("slide-in");
        fact.style.opacity = "1";

        timers.push(
          window.setTimeout(() => {
            figure.classList.remove("slide-in");
            transitioning = false;
          }, 350),
        );
      }, 200),
    );
  }

  function goMascot(dir: -1 | 1) {
    const nextIndex = (currentMascot + dir + MASCOTS.length) % MASCOTS.length;
    animateMascotChange(nextIndex);
  }

  const dotsEl = document.getElementById("mascotDots");
  const leftBtn = document.getElementById("mascotLeft");
  const rightBtn = document.getElementById("mascotRight");

  if (dotsEl) {
    dotsEl.innerHTML = "";
    MASCOTS.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.className = "mascot-dot";
      dot.type = "button";
      dot.setAttribute("aria-label", `Show mascot ${index + 1}`);
      dot.addEventListener("click", () => animateMascotChange(index));
      dotsEl.appendChild(dot);
    });
  }

  renderMascot();

  const onLeft = () => goMascot(-1);
  const onRight = () => goMascot(1);
  leftBtn?.addEventListener("click", onLeft);
  rightBtn?.addEventListener("click", onRight);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!document.getElementById("page-home")?.classList.contains("active")) return;
    if (event.key === "ArrowLeft") goMascot(-1);
    if (event.key === "ArrowRight") goMascot(1);
  };

  document.addEventListener("keydown", onKeyDown);

  return () => {
    timers.forEach((id) => window.clearTimeout(id));
    leftBtn?.removeEventListener("click", onLeft);
    rightBtn?.removeEventListener("click", onRight);
    document.removeEventListener("keydown", onKeyDown);
  };
}
