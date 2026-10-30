import { reservationDateError, todayInAmsterdam } from '../lib/reservationDate.ts';

const fieldNames = ['reservationDate', 'reservationTime', 'guestCount', 'name', 'phone', 'email', 'message'] as const;
type FieldName = typeof fieldNames[number];
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const genericError = 'Er ging iets mis bij het versturen. Probeer het later opnieuw of neem telefonisch contact met ons op.';
const unavailableError = 'Online reserveren is tijdelijk niet mogelijk. Probeer het later opnieuw of neem contact met ons op via WhatsApp of telefoon.';
const responseError = 'We kunnen niet controleren of je aanvraag is ontvangen. Neem contact met ons op via WhatsApp of telefoon voordat je opnieuw verstuurt.';
const networkError = `Er is een verbindingsprobleem. ${responseError}`;

function rateLimitMessage(retryAfter: string | null): string {
  const prefix = 'Er zijn te veel aanvragen gedaan.';
  const fallback = `${prefix} Probeer het later opnieuw.`;
  if (!retryAfter || retryAfter.length > 64) return fallback;
  const value = retryAfter.trim();
  let seconds: number;
  if (/^\d+$/.test(value)) seconds = Number(value);
  else {
    // Accepteer alleen een volledige HTTP-datum; Date.parse alleen is te soepel.
    if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return fallback;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toUTCString() !== value) return fallback;
    seconds = Math.ceil((timestamp - Date.now()) / 1000);
  }
  // De server gebruikt een venster van 15 minuten; onredelijke wachttijden worden niet overgenomen.
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 15 * 60) return fallback;
  const amount = seconds < 60 ? seconds : Math.ceil(seconds / 60);
  const unit = seconds < 60 ? (amount === 1 ? 'seconde' : 'seconden') : (amount === 1 ? 'minuut' : 'minuten');
  return `${prefix} Probeer het over ${amount} ${unit} opnieuw.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function initReservationForm(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('[data-reservation-form]')!;
  const fieldset = form.querySelector<HTMLFieldSetElement>('[data-form-fields]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const formError = form.querySelector<HTMLElement>('[data-form-error]')!;
  const success = root.querySelector<HTMLElement>('[data-reservation-success]')!;
  const controls = Object.fromEntries(fieldNames.map((name) => [name, form.querySelector<Control>(`[name="${name}"]`)!])) as Record<FieldName, Control>;
  const date = controls.reservationDate as HTMLInputElement;
  let submitting = false;

  function showFieldError(name: FieldName, message = '') {
    const element = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`)!;
    element.textContent = message;
    element.hidden = !message;
    if (message) controls[name].setAttribute('aria-invalid', 'true');
    else controls[name].removeAttribute('aria-invalid');
  }

  function showFormError(message: string, focus = true) {
    formError.textContent = message;
    formError.hidden = false;
    if (focus) formError.focus();
  }

  function validateField(name: FieldName): boolean {
    const control = controls[name];
    let message = '';
    if (control.required && !control.value.trim()) message = 'Dit veld is verplicht.';
    else if (name === 'reservationDate' && control.value) message = reservationDateError(control.value) ?? '';
    else if (!control.validity.valid) {
      if (name === 'email') message = 'Vul een geldig e-mailadres in.';
      else if (name === 'guestCount') message = 'Vul een geheel aantal personen van minimaal 1 in.';
      else message = 'Controleer de ingevulde waarde.';
    }
    showFieldError(name, message);
    return !message;
  }

  date.min = todayInAmsterdam();
  form.addEventListener('focusin', () => { date.min = todayInAmsterdam(); });
  for (const name of fieldNames) {
    controls[name].addEventListener('change', () => validateField(name));
    controls[name].addEventListener('input', () => {
      if (controls[name].getAttribute('aria-invalid') === 'true') validateField(name);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || form.hidden) return;
    formError.hidden = true;
    date.min = todayInAmsterdam();
    const invalid = fieldNames.filter((name) => !validateField(name));
    if (invalid.length) {
      showFormError('Controleer de gemarkeerde velden.', false);
      controls[invalid[0]].focus();
      return;
    }

    const payload = {
      reservationDate: controls.reservationDate.value,
      reservationTime: controls.reservationTime.value,
      name: controls.name.value,
      phone: controls.phone.value,
      email: controls.email.value,
      message: controls.message.value,
      guestCount: Number(controls.guestCount.value),
      contact_url: form.querySelector<HTMLInputElement>('[name="contact_url"]')!.value,
    };
    submitting = true;
    submit.disabled = true;
    submit.textContent = 'Versturen…';
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(form.action, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(payload),
      });
      if (response.status === 429) {
        showFormError(rateLimitMessage(response.headers.get('Retry-After')));
        return;
      }
      if (response.status === 503) {
        showFormError(unavailableError);
        return;
      }
      if (response.status !== 201 && response.status !== 400) {
        showFormError(genericError);
        return;
      }
      let result: unknown;
      try {
        if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
          showFormError(responseError);
          return;
        }
        result = await response.json();
      } catch {
        showFormError(responseError);
        return;
      }
      if (response.status === 201 && isRecord(result) && result.success === true && result.status === 'pending'
        && /^[1-9]\d*$/.test(String(result.reservationId))) {
        root.querySelector<HTMLElement>('[data-summary-date]')!.textContent = new Intl.DateTimeFormat('nl-NL', {
          dateStyle: 'long', timeZone: 'Europe/Amsterdam',
        }).format(new Date(`${payload.reservationDate}T12:00:00Z`));
        root.querySelector<HTMLElement>('[data-summary-time]')!.textContent = payload.reservationTime;
        root.querySelector<HTMLElement>('[data-summary-guests]')!.textContent = String(payload.guestCount);
        form.reset();
        form.hidden = true;
        fieldset.disabled = true;
        success.hidden = false;
        success.focus();
      } else if (response.status === 400 && isRecord(result) && isRecord(result.error)
        && result.error.code === 'VALIDATION_ERROR' && isRecord(result.error.fields)) {
        const errors = result.error.fields;
        const invalid = fieldNames.filter((name) => typeof errors[name] === 'string' && errors[name].length > 0 && errors[name].length <= 300);
        invalid.forEach((name) => showFieldError(name, errors[name] as string));
        showFormError('Controleer de gemarkeerde velden.', false);
        if (invalid.length) controls[invalid[0]].focus();
        else showFormError('Controleer je gegevens en probeer het opnieuw.');
      } else showFormError(response.status === 201 ? responseError : genericError);
    } catch {
      showFormError(networkError);
    } finally {
      submitting = false;
      submit.disabled = false;
      submit.textContent = 'Verstuur aanvraag';
      form.removeAttribute('aria-busy');
    }
  });

  root.querySelector<HTMLButtonElement>('[data-new-request]')!.addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    fieldset.disabled = false;
    date.min = todayInAmsterdam();
    date.focus();
  });
  form.noValidate = true;
  fieldset.disabled = false;
}
