import type { Cleanup } from "../types";
import { submitNewsletterSignup } from "../newsletter.functions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ensureStatusEl(form: HTMLFormElement): HTMLElement {
  let status = form.parentElement?.querySelector<HTMLElement>(".newsletter-status") ?? null;
  if (!status) {
    status = document.createElement("p");
    status.className = "newsletter-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.insertAdjacentElement("afterend", status);
  }
  return status;
}

function wireForm(form: HTMLFormElement): () => void {
  const input = form.querySelector<HTMLInputElement>(".newsletter-input");
  const button = form.querySelector<HTMLButtonElement>(".newsletter-btn");
  const consent = form.querySelector<HTMLInputElement>(".newsletter-consent-box");
  const honeypot = form.querySelector<HTMLInputElement>(".newsletter-hp-field");
  const status = ensureStatusEl(form);

  const setStatus = (message: string, kind: "ok" | "err" | "pending") => {
    status.textContent = message;
    status.dataset.kind = kind;
  };

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    const email = (input?.value ?? "").trim();

    if (!EMAIL_RE.test(email)) {
      setStatus("Please enter a valid email address.", "err");
      input?.focus();
      return;
    }

    if (consent && !consent.checked) {
      setStatus("Please tick the consent box so we can email you.", "err");
      consent.focus();
      return;
    }

    if (button) button.disabled = true;
    setStatus("Signing you up…", "pending");

    try {
      const result = await submitNewsletterSignup({
        data: {
          email,
          company: honeypot?.value ?? "",
          consent: consent?.checked === true,
          consentVersion: consent?.dataset.consentVersion ?? "",
        },
      });

      if (result.ok) {
        form.reset();
        setStatus("You're on the list! 💜", "ok");
      } else if (result.reason === "not-configured") {
        setStatus("Newsletter signup isn't switched on yet — check back soon! 💜", "err");
      } else {
        setStatus("That didn't go through — please try again in a bit.", "err");
      }
    } catch {
      setStatus("Couldn't reach the server — check your connection and try again.", "err");
    } finally {
      if (button) button.disabled = false;
    }
  };

  form.addEventListener("submit", onSubmit);
  return () => form.removeEventListener("submit", onSubmit);
}

/** Wires the "stay in the loop" form to submit into a Google Form / Sheet. */
export function mountNewsletter(): Cleanup {
  const forms = document.querySelectorAll<HTMLFormElement>(".newsletter-form");
  const teardowns = [...forms].map(wireForm);
  return () => teardowns.forEach((fn) => fn());
}
