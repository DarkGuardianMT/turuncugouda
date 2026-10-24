import assert from 'node:assert/strict';
import { test } from 'node:test';
import { site } from '../src/data/site.ts';

test('central WhatsApp contact uses the verified phone in international digits without a prefilled message', () => {
  const url = new URL(site.whatsappHref);
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, `/${site.phone.replace(/\D/g, '')}`);
  assert.equal(url.search, ''); assert.equal(url.hash, '');
});

test('shared reservation guidance directs requests to the form and requires confirmation', () => {
  assert.match(site.reservationMessage, /reserveringsaanvraag via het formulier/);
  assert.match(site.reservationMessage, /pas definitief nadat Turuncu deze heeft bevestigd/);
  assert.doesNotMatch(site.reservationMessage, /bellen|bel ons|Instagram/i);
});
