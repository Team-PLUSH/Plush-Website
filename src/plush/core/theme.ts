import type { Cleanup } from "../types";

const STORAGE_KEY = "plush-theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
}

export function mountTheme(): Cleanup {
  const themeBtn = document.getElementById("themeToggle");
  applyTheme(localStorage.getItem(STORAGE_KEY) !== "light");

  if (!themeBtn) return () => {};

  const onToggle = () => applyTheme(!document.documentElement.classList.contains("dark"));
  themeBtn.addEventListener("click", onToggle);
  return () => themeBtn.removeEventListener("click", onToggle);
}
