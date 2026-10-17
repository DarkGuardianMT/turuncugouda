import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedReservationOrigin, preparePublicReservationInput } from '../src/server/reservations/requestGuards.ts';
import { validateReservation } from '../src/server/reservations/validation.ts';
import { todayInAmsterdam } from '../src/lib/reservationDate.ts';

const valid = { name: 'Test', phone: '+31612345678', reservationDate: '2026-10-20', reservationTime: '13:31', guestCount: 4 };
const now = new Date('2026-10-17T12:00:00Z');

test('empty or absent honeypot follows the unchanged validation path', () => {
  for (const payload of [valid, { ...valid, contact_url: '' }]) {
    const result = preparePublicReservationInput(payload);
    assert.equal(result.blocked, false);
    if (!result.blocked) {
      assert.deepEqual(result.input, valid);
      assert.equal(validateReservation(result.input, now).success, true);
    }
  }
});

test('populated or mistyped honeypot is blocked before reservation validation/creation', () => {
  for (const contact_url of ['https://example.com', 'spam', ' ', 123, null, {}, []]) {
    assert.deepEqual(preparePublicReservationInput({ ...valid, contact_url }), { blocked: true });
  }
});

test('empty honeypot never bypasses required fields or managed-field rejection', () => {
  for (const input of [{ contact_url: '' }, { ...valid, contact_url: '', status: 'confirmed' }]) {
    const result = preparePublicReservationInput(input);
    assert.equal(result.blocked, false);
    if (!result.blocked) assert.equal(validateReservation(result.input, now).success, false);
  }
});

test('invalid body shapes still go through normal validation', () => {
  for (const input of [null, [], 'value', 4]) {
    const result = preparePublicReservationInput(input);
    assert.equal(result.blocked, false);
    if (!result.blocked) assert.equal(validateReservation(result.input, now).success, false);
  }
});

for (const origin of ['http://localhost:4321', 'http://127.0.0.1:4321', 'https://www.turuncugouda.com']) {
  test(`allows exact same origin ${origin}`, () => {
    assert.equal(isAllowedReservationOrigin(new Request(`${origin}/api/reservations`, { headers: { origin, 'sec-fetch-site': 'same-origin' } })), true);
  });
}

for (const origin of ['https://example.com', 'http://localhost:4322', 'https://www.turuncugouda.com', 'null', 'http://localhost:4321/path']) {
  test(`rejects a different/invalid origin ${origin}`, () => {
    assert.equal(isAllowedReservationOrigin(new Request('http://localhost:4321/api/reservations', { headers: { origin } })), false);
  });
}

test('supports non-browser clients without Origin but rejects cross-site browser metadata', () => {
  assert.equal(isAllowedReservationOrigin(new Request('http://localhost:4321/api/reservations')), true);
  assert.equal(isAllowedReservationOrigin(new Request('http://localhost:4321/api/reservations', { headers: { 'sec-fetch-site': 'cross-site' } })), false);
});

test('shared restaurant date uses Amsterdam rather than UTC at midnight', () => {
  assert.equal(todayInAmsterdam(new Date('2026-10-20T22:30:00Z')), '2026-10-21');
  assert.equal(todayInAmsterdam(new Date('2026-12-01T23:30:00Z')), '2026-12-02');
});
