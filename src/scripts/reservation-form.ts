import { reservationDateError, todayInAmsterdam } from '../lib/reservationDate.ts';

const fieldNames = ['reservationDate', 'reservationTime', 'guestCount', 'name', 'phone', 'email', 'message'] as const;
type FieldName = typeof fieldNames[number];
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const genericError = 'Er ging iets mis bij het versturen. Probeer het later opnieuw of neem telefonisch contact met ons op.';

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
      const result: unknown = await response.json();
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
      } else showFormError(genericError);
    } catch {
      showFormError(genericError);
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
