import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initReservationForm } from '../src/scripts/reservation-form.ts';
import { todayInAmsterdam } from '../src/lib/reservationDate.ts';

class ElementStub {
  value = '';
  textContent = '';
  hidden = false;
  disabled = false;
  required = false;
  min = '';
  noValidate = false;
  focused = false;
  validity = { valid: true };
  action = 'http://localhost:4321/api/reservations';
  attributes = new Map<string, string>();
  elements = new Map<string, ElementStub>();
  listeners = new Map<string, ((event: Event) => unknown)[]>();
  querySelector(selector: string) { return this.elements.get(selector) ?? null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  focus() { this.focused = true; }
  reset() { for (const [selector, element] of this.elements) if (selector.startsWith('[name=')) element.value = ''; }
  addEventListener(type: string, listener: (event: Event) => unknown) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  async emit(type: string) {
    const event = new Event(type, { cancelable: true });
    await Promise.all((this.listeners.get(type) ?? []).map((listener) => listener(event)));
    return event;
  }
}

function nextDate(day: (weekday: number) => boolean): string {
  const date = new Date(`${todayInAmsterdam()}T12:00:00Z`);
  do { date.setUTCDate(date.getUTCDate() + 1); } while (!day(date.getUTCDay()));
  return date.toISOString().slice(0, 10);
}

function fixture() {
  const root = new ElementStub();
  const form = new ElementStub();
  const fieldset = new ElementStub(); fieldset.disabled = true;
  const submit = new ElementStub();
  const formError = new ElementStub(); formError.hidden = true;
  const success = new ElementStub(); success.hidden = true;
  const newRequest = new ElementStub();
  root.elements.set('[data-reservation-form]', form);
  root.elements.set('[data-reservation-success]', success);
  root.elements.set('[data-new-request]', newRequest);
  for (const selector of ['[data-summary-date]', '[data-summary-time]', '[data-summary-guests]']) root.elements.set(selector, new ElementStub());
  form.elements.set('[data-form-fields]', fieldset);
  form.elements.set('[data-submit]', submit);
  form.elements.set('[data-form-error]', formError);
  const values = { reservationDate: nextDate(day => day >= 2 && day <= 6), reservationTime: '13:30', guestCount: '4', name: 'Example', phone: '+31612345678', email: '', message: '', contact_url: '' };
  const controls = Object.fromEntries(Object.entries(values).map(([name, value]) => {
    const control = new ElementStub(); control.value = value;
    control.required = ['reservationDate', 'reservationTime', 'guestCount', 'name', 'phone'].includes(name);
    form.elements.set(`[name="${name}"]`, control);
    const error = new ElementStub(); error.hidden = true;
    form.elements.set(`[data-error-for="${name}"]`, error);
    return [name, control];
  })) as Record<keyof typeof values, ElementStub>;
  initReservationForm(root as unknown as HTMLElement);
  return { root, form, fieldset, submit, formError, success, newRequest, controls,
    fieldError: (name: string) => form.elements.get(`[data-error-for="${name}"]`)! };
}

test('enhancement enables the form and sets a dynamic Amsterdam date minimum', () => {
  const view = fixture();
  assert.equal(view.fieldset.disabled, false);
  assert.equal(view.form.noValidate, true);
  assert.equal(view.controls.reservationDate.min, todayInAmsterdam());
});

test('required field errors are inline, marked invalid, focused and stop submission', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  const view = fixture(); view.controls.name.value = ' ';
  const event = await view.form.emit('submit');
  assert.equal(event.defaultPrevented, true);
  assert.equal(view.controls.name.getAttribute('aria-invalid'), 'true');
  assert.equal(view.controls.name.focused, true);
  assert.equal(view.fieldError('name').textContent, 'Dit veld is verplicht.');
  assert.equal(view.formError.hidden, false);
  assert.equal(fetch.mock.callCount(), 0);
  view.controls.name.value = 'Example'; await view.controls.name.emit('input');
  assert.equal(view.controls.name.getAttribute('aria-invalid'), null);
  assert.equal(view.fieldError('name').hidden, true);
});

test('closed days and past dates show immediate feedback using the shared rules', async () => {
  const view = fixture();
  for (const [weekday, message] of [[1, 'maandag'], [0, 'zondag']] as const) {
    view.controls.reservationDate.value = nextDate(day => day === weekday);
    await view.controls.reservationDate.emit('change');
    assert.match(view.fieldError('reservationDate').textContent, new RegExp(message));
  }
  view.controls.reservationDate.value = '2000-01-01'; await view.controls.reservationDate.emit('change');
  assert.match(view.fieldError('reservationDate').textContent, /vandaag of een toekomstige datum/);
});

test('native email/number constraint failures produce Dutch inline errors', async () => {
  const view = fixture();
  for (const name of ['email', 'guestCount'] as const) {
    view.controls[name].validity.valid = false;
    await view.controls[name].emit('change');
    assert.equal(view.controls[name].getAttribute('aria-invalid'), 'true');
    assert.equal(view.fieldError(name).hidden, false);
  }
});

test('locks double submission, sends only API fields, clears PII and shows a focused success summary', async (context) => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>(done => { resolve = done; });
  let sent: Record<string, unknown> = {};
  const fetch = context.mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    sent = JSON.parse(String(options?.body)) as Record<string, unknown>;
    return pending;
  });
  const view = fixture();
  const first = view.form.emit('submit');
  assert.equal(view.submit.disabled, true);
  assert.equal(view.form.getAttribute('aria-busy'), 'true');
  assert.equal(view.submit.textContent, 'Versturen…');
  await view.form.emit('submit'); assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(Object.keys(sent).sort(), ['contact_url','email','guestCount','message','name','phone','reservationDate','reservationTime'].sort());
  assert.equal(sent.guestCount, 4);
  view.controls.reservationTime.value = '16:00';
  resolve(Response.json({ success: true, reservationId: 123, status: 'pending' }, { status: 201 }));
  await first;
  assert.equal(view.success.hidden, false); assert.equal(view.success.focused, true);
  assert.equal(view.form.hidden, true); assert.equal(view.fieldset.disabled, true);
  for (const control of Object.values(view.controls)) assert.equal(control.value, '');
  assert.equal(view.root.elements.get('[data-summary-time]')!.textContent, '13:30');
  assert.equal(view.root.elements.get('[data-summary-guests]')!.textContent, '4');
  await view.form.emit('submit'); assert.equal(fetch.mock.callCount(), 1);
  await view.newRequest.emit('click');
  assert.equal(view.success.hidden, true); assert.equal(view.form.hidden, false);
  assert.equal(view.fieldset.disabled, false); assert.equal(view.controls.reservationDate.focused, true);
});

test('authoritative server field errors are associated with controls and preserve input', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ success: false, error: {
    code: 'VALIDATION_ERROR', fields: { phone: 'Vul een geldig telefoonnummer in.' },
  } }, { status: 400 }));
  const view = fixture(); await view.form.emit('submit');
  assert.equal(view.fieldError('phone').textContent, 'Vul een geldig telefoonnummer in.');
  assert.equal(view.controls.phone.getAttribute('aria-invalid'), 'true');
  assert.equal(view.controls.phone.focused, true);
  assert.equal(view.controls.name.value, 'Example'); assert.equal(view.submit.disabled, false);
});

function assertFailure(view: ReturnType<typeof fixture>) {
  assert.equal(view.formError.hidden, false); assert.equal(view.formError.focused, true);
  assert.doesNotMatch(view.formError.textContent, /private technical detail|<script>/);
  assert.equal(view.success.hidden, true); assert.equal(view.form.hidden, false);
  assert.equal(view.fieldset.disabled, false); assert.equal(view.submit.disabled, false);
  assert.equal(view.submit.textContent, 'Verstuur aanvraag');
  assert.equal(view.form.getAttribute('aria-busy'), null);
  assert.deepEqual(Object.fromEntries(Object.entries(view.controls).map(([name, control]) => [name, control.value])), {
    reservationDate: nextDate(day => day >= 2 && day <= 6), reservationTime: '13:30', guestCount: '4',
    name: 'Example', phone: '+31612345678', email: '', message: '', contact_url: '',
  });
}

test('429 gives bounded retry advice even with an HTML body and never accepts a success payload', async (context) => {
  let response: Response;
  const fetch = context.mock.method(globalThis, 'fetch', async () => response);
  for (const candidate of [
    new Response('<html>private technical detail</html>', { status: 429, headers: { 'Retry-After': '61' } }),
    Response.json({ success: true, reservationId: 1, status: 'pending' }, { status: 429, headers: { 'Retry-After': '61' } }),
  ]) {
    response = candidate;
    const view = fixture(); await view.form.emit('submit');
    assert.equal(view.formError.textContent, 'Er zijn te veel aanvragen gedaan. Probeer het over 2 minuten opnieuw.');
    assertFailure(view);
  }
  assert.equal(fetch.mock.callCount(), 2);
});

test('Retry-After accepts seconds and strict future HTTP dates, rounding advice up without automatic retries', async (context) => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  context.mock.method(Date, 'now', () => now);
  let header = '';
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429, headers: { 'Retry-After': header } }));
  const cases = [
    ['1', '1 seconde'], ['59', '59 seconden'], ['60', '1 minuut'], ['61', '2 minuten'], ['900', '15 minuten'], ['00060', '1 minuut'],
    [new Date(now + 30_000).toUTCString(), '30 seconden'], [new Date(now + 61_000).toUTCString(), '2 minuten'],
    [new Date(now + 900_000).toUTCString(), '15 minuten'],
  ];
  for (const [value, advice] of cases) {
    header = value;
    const view = fixture(); await view.form.emit('submit');
    assert.equal(view.formError.textContent, `Er zijn te veel aanvragen gedaan. Probeer het over ${advice} opnieuw.`);
    assertFailure(view);
  }
  assert.equal(fetch.mock.callCount(), cases.length);
});

test('Retry-After ignores missing, hostile, malformed, past and unreasonably long values', async (context) => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  context.mock.method(Date, 'now', () => now);
  let header: string | null = null;
  context.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429, headers: header === null ? {} : { 'Retry-After': header } }));
  for (const value of [null, '', '0', '-1', '+60', '1.5', '1e2', 'Infinity', 'NaN', '901', '9999999999999999999999',
    '1'.repeat(65), '60, 120', '<script>private technical detail</script>', '2026-10-29',
    new Date(now).toUTCString(), new Date(now - 1000).toUTCString(), new Date(now + 901_000).toUTCString(),
    'Fri, 29 Oct 2026 12:01:00 GMT', 'Thu, 32 Oct 2026 12:01:00 GMT']) {
    header = value;
    const view = fixture(); await view.form.emit('submit');
    assert.equal(view.formError.textContent, 'Er zijn te veel aanvragen gedaan. Probeer het later opnieuw.', String(value));
    assertFailure(view);
  }
});

test('503 offers WhatsApp or telephone contact for JSON and non-JSON responses', async (context) => {
  let response: Response;
  context.mock.method(globalThis, 'fetch', async () => response);
  for (const candidate of [
    new Response('<html>private technical detail</html>', { status: 503 }),
    Response.json({ error: { message: 'private technical detail' } }, { status: 503 }),
  ]) {
    response = candidate;
    const view = fixture(); await view.form.emit('submit');
    assert.match(view.formError.textContent, /Online reserveren is tijdelijk niet mogelijk/);
    assert.match(view.formError.textContent, /WhatsApp of telefoon/);
    assertFailure(view);
  }
});

test('500 and other unexpected statuses show a safe generic error regardless of response body', async (context) => {
  let response: Response;
  context.mock.method(globalThis, 'fetch', async () => response);
  for (const status of [200, 403, 500, 502, 504]) {
    response = new Response('<html>private technical detail</html>', { status });
    const view = fixture(); await view.form.emit('submit');
    assert.match(view.formError.textContent, /Er ging iets mis bij het versturen/);
    assertFailure(view);
  }
});

test('network failure warns that receipt is unknown and restores the form without showing success', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('private technical detail'); });
  const view = fixture(); await view.form.emit('submit');
  assert.match(view.formError.textContent, /verbindingsprobleem/);
  assert.match(view.formError.textContent, /niet controleren of je aanvraag is ontvangen/);
  assert.match(view.formError.textContent, /contact.*voordat je opnieuw verstuurt/);
  assertFailure(view);
});

test('malformed, non-JSON and invalid success responses never imply receipt or clear entered values', async (context) => {
  let response: Response;
  context.mock.method(globalThis, 'fetch', async () => response);
  for (const candidate of [
    new Response('private technical detail', { status: 201, headers: { 'Content-Type': 'application/json' } }),
    new Response(null, { status: 400, headers: { 'Content-Type': 'application/json' } }),
    new Response('<html>private technical detail</html>', { status: 201, headers: { 'Content-Type': 'text/html' } }),
    new Response(JSON.stringify({ success: true, reservationId: 1, status: 'pending' }), { status: 201 }),
    Response.json({ success: true }, { status: 201 }),
    Response.json({ success: true, reservationId: 1, status: 'confirmed' }, { status: 201 }),
  ]) {
    response = candidate;
    const view = fixture(); await view.form.emit('submit');
    assert.match(view.formError.textContent, /niet controleren of je aanvraag is ontvangen/);
    assert.match(view.formError.textContent, /contact.*voordat je opnieuw verstuurt/);
    assertFailure(view);
  }
});

test('all entered optional contact details and messages survive a failure and a manual retry can succeed', async (context) => {
  let attempts = 0;
  context.mock.method(globalThis, 'fetch', async () => ++attempts === 1 ? new Response(null, { status: 503 })
    : Response.json({ success: true, reservationId: 123, status: 'pending' }, { status: 201 }));
  const view = fixture();
  view.controls.email.value = 'example@example.invalid'; view.controls.message.value = 'Kinderstoel';
  await view.form.emit('submit');
  assert.equal(view.controls.email.value, 'example@example.invalid'); assert.equal(view.controls.message.value, 'Kinderstoel');
  await view.form.emit('submit');
  assert.equal(attempts, 2); assert.equal(view.success.hidden, false); assert.equal(view.success.focused, true);
  assert.equal(view.formError.hidden, true); assert.equal(view.controls.email.value, ''); assert.equal(view.controls.message.value, '');
});
