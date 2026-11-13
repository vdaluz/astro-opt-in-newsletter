export interface NewsletterSignupOptions {
  /** Same-origin path of the site's subscribe endpoint, e.g. `/api/newsletter-subscribe`. */
  endpoint: string;
  /** Extra JSON body fields sent with the email, e.g. `{ locale: 'pt' }` for per-locale lists. */
  extraFields?: Record<string, string>;
  /** Class toggled on the status element while it shows an error. Defaults to `text-error`. */
  errorClass?: string;
}

/**
 * Wires one signup block. Expected markup inside `root`:
 * - a `<form>` with `data-invalid-email-message` and `data-error-message`
 * - an `input[type="email"]`, a `button[type="submit"]` and a `[role="status"]` element
 * - a hidden `[data-confirmation]` block containing a focusable `[data-confirmation-heading]`
 *   and a `[data-confirmation-email]` element
 */
export function initNewsletterSignup(root: HTMLElement, options: NewsletterSignupOptions): void {
  const form = root.querySelector('form');
  const emailInput = root.querySelector<HTMLInputElement>('input[type="email"]');
  const status = root.querySelector<HTMLElement>('[role="status"]');
  const submitButton = root.querySelector<HTMLButtonElement>('button[type="submit"]');
  const confirmation = root.querySelector<HTMLElement>('[data-confirmation]');
  const confirmationHeading = root.querySelector<HTMLElement>('[data-confirmation-heading]');
  const confirmationEmail = root.querySelector<HTMLElement>('[data-confirmation-email]');
  if (
    !form ||
    !emailInput ||
    !status ||
    !submitButton ||
    !confirmation ||
    !confirmationHeading ||
    !confirmationEmail
  ) {
    return;
  }

  const setStatus = (message: string, fieldInvalid = false) => {
    status.textContent = message;
    status.classList.toggle(options.errorClass ?? 'text-error', message !== '');
    emailInput.setAttribute('aria-invalid', fieldInvalid ? 'true' : 'false');
  };

  let submitting = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const email = emailInput.value.trim();

    if (!emailInput.checkValidity()) {
      setStatus(form.dataset.invalidEmailMessage ?? '', true);
      return;
    }

    // aria-busy, not disabled: disabling the focused button drops focus to <body>.
    submitting = true;
    submitButton.setAttribute('aria-busy', 'true');
    setStatus('');

    try {
      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...options.extraFields, email }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (response.ok && data.ok) {
        confirmationEmail.textContent = email;
        form.hidden = true;
        confirmation.classList.remove('hidden');
        confirmation.hidden = false;
        confirmationHeading.focus();
      } else if (data.error === 'invalid_email') {
        setStatus(form.dataset.invalidEmailMessage ?? '', true);
      } else {
        setStatus(form.dataset.errorMessage ?? '');
      }
    } catch {
      setStatus(form.dataset.errorMessage ?? '');
    } finally {
      submitting = false;
      submitButton.removeAttribute('aria-busy');
    }
  });
}
