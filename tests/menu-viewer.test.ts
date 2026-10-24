import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initMenuViewer } from '../src/scripts/menu-viewer.ts';

class ElementStub {
  dataset: Record<string, string> = {};
  style = { overflow: '', width: '', height: '' };
  disabled = true; hidden = false; open = false; complete = true; naturalWidth = 997;
  clientWidth = 800; clientHeight = 600; scrollLeft = 0; scrollTop = 0;
  textContent = ''; value = ''; src = ''; alt = '';
  attributes = new Map<string, string>();
  elements = new Map<string, ElementStub>();
  triggers: ElementStub[] = [];
  listeners = new Map<string, ((event: Event) => void)[]>();
  captured = new Set<number>();
  ownerDocument!: { documentElement: ElementStub; activeElement: ElementStub | null; defaultView: ElementStub };
  querySelector(selector: string) { return this.elements.get(selector) ?? null; }
  querySelectorAll() { return this.triggers; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); }
  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, properties: Record<string, unknown> = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), properties);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
}

function fixture() {
  const root = new ElementStub(), dialog = new ElementStub();
  const documentElement = new ElementStub(); documentElement.style.overflow = 'auto';
  const owner = { documentElement, activeElement: null as ElementStub | null, defaultView: new ElementStub() };
  root.elements.set('#menu-viewer', dialog);
  const selectors = ['stage', 'canvas', 'image', 'error', 'count', 'zoom', 'close', 'zoom-in', 'zoom-out', 'previous', 'next', 'reset'];
  const controls = Object.fromEntries(selectors.map((name) => {
    const element = new ElementStub(); element.ownerDocument = owner;
    dialog.elements.set(`[data-menu-${name}]`, element); return [name, element];
  }));
  dialog.ownerDocument = owner;
  root.triggers = Array.from({ length: 2 }, (_, index) => {
    const trigger = new ElementStub(); trigger.ownerDocument = owner;
    trigger.dataset = { menuSrc: `/menu-web-${index + 1}.webp`, menuWidth: '997', menuHeight: String(index === 0 ? 1618 : 1616) };
    return trigger;
  });
  initMenuViewer(root as unknown as ParentNode);
  return { root, dialog, owner, controls, triggers: root.triggers };
}

test('both full-menu triggers open the corresponding sheet and close restores focus and original scroll state', () => {
  const { dialog, owner, controls, triggers } = fixture();
  for (const [index, trigger] of triggers.entries()) {
    assert.equal(trigger.disabled, false);
    trigger.emit('click');
    assert.equal(dialog.open, true); assert.equal(owner.documentElement.style.overflow, 'hidden');
    assert.equal(controls.image.src, `/menu-web-${index + 1}.webp`);
    assert.equal(controls.count.textContent, `${index + 1} / 2`);
    assert.equal(owner.activeElement, controls.close);
    controls.close.emit('click');
    assert.equal(dialog.open, false); assert.equal(owner.activeElement, trigger);
    assert.equal(owner.documentElement.style.overflow, 'auto');
  }
});

test('previous/next wrap between two sheets, keyboard switches sheets, and sheet changes reset zoom', () => {
  const { dialog, controls, triggers } = fixture(); triggers[0].emit('click');
  controls.previous.emit('click'); assert.equal(controls.count.textContent, '2 / 2');
  controls.next.emit('click'); assert.equal(controls.count.textContent, '1 / 2');
  controls['zoom-in'].emit('click'); assert.equal(controls.zoom.value, '150%');
  assert.equal(dialog.emit('keydown', { key: 'ArrowRight' }).defaultPrevented, true);
  assert.equal(controls.count.textContent, '2 / 2'); assert.equal(controls.zoom.value, '100%');
  dialog.emit('keydown', { key: 'ArrowLeft' }); assert.equal(controls.count.textContent, '1 / 2');
  assert.equal(dialog.emit('keydown', { key: 'Escape' }).defaultPrevented, false, 'Native dialog Escape handling remains available');
  dialog.close(); assert.equal(dialog.open, false);
});

test('zoom stays within 100–400%, resets to fit and preserves a usable pan area', () => {
  const { dialog, controls, triggers } = fixture(); triggers[0].emit('click');
  assert.equal(controls['zoom-out'].disabled, true);
  for (let i = 0; i < 10; i++) dialog.emit('keydown', { key: '+' });
  assert.equal(controls.zoom.value, '400%'); assert.equal(controls['zoom-in'].disabled, true);
  assert.ok(Number.parseFloat(controls.canvas.style.width) > controls.stage.clientWidth);
  assert.ok(Number.parseFloat(controls.canvas.style.height) > controls.stage.clientHeight);
  controls.reset.emit('click'); assert.equal(controls.zoom.value, '100%');
  assert.equal(controls.stage.scrollLeft, 0); assert.equal(controls.stage.scrollTop, 0);
  dialog.emit('keydown', { key: '-' }); assert.equal(controls.zoom.value, '100%');
  dialog.emit('keydown', { key: '+', ctrlKey: true }); assert.equal(controls.zoom.value, '100%');
});

test('mouse drag pans only while zoomed, touch keeps native scrolling and cancellation releases capture', () => {
  const { dialog, controls, triggers } = fixture(); triggers[0].emit('click');
  const stage = controls.stage;
  const pointer = { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300, clientY: 250 };
  stage.emit('pointerdown', pointer); assert.equal(stage.captured.size, 0);
  for (let i = 0; i < 6; i++) dialog.emit('keydown', { key: '+' });
  const before = { x: stage.scrollLeft, y: stage.scrollTop };
  assert.equal(stage.emit('pointerdown', { ...pointer, pointerType: 'touch' }).defaultPrevented, false);
  assert.equal(stage.captured.size, 0);
  stage.emit('pointerdown', pointer); assert.equal(stage.captured.size, 1);
  stage.emit('pointermove', { ...pointer, clientX: 200, clientY: 180 });
  assert.equal(stage.scrollLeft, before.x + 100); assert.equal(stage.scrollTop, before.y + 70);
  stage.emit('pointercancel'); assert.equal(stage.captured.size, 0); assert.equal(stage.dataset.dragging, 'false');
  const left = stage.scrollLeft;
  dialog.emit('keydown', { key: 'ArrowRight', shiftKey: true }); assert.equal(stage.scrollLeft, left + 80);
  assert.equal(controls.count.textContent, '1 / 2');
});

test('failed images expose the safe fallback and the other sheet restores the image canvas', () => {
  const { controls, triggers } = fixture(); triggers[0].emit('click');
  controls.image.emit('error'); assert.equal(controls.error.hidden, false); assert.equal(controls.canvas.hidden, true);
  controls.next.emit('click'); assert.equal(controls.error.hidden, true); assert.equal(controls.canvas.hidden, false);
  controls.image.emit('load'); assert.equal(controls.stage.attributes.get('aria-busy'), 'false');
});
