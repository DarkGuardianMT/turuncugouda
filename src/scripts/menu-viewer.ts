export function initMenuViewer(root: ParentNode = document): void {
  const dialog = root.querySelector<HTMLDialogElement>('#menu-viewer');
  const triggers = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-menu-sheet]'));
  if (!dialog || !triggers.length || typeof dialog.showModal !== 'function') return;
  const stage = dialog.querySelector<HTMLElement>('[data-menu-stage]')!;
  const canvas = dialog.querySelector<HTMLElement>('[data-menu-canvas]')!;
  const image = dialog.querySelector<HTMLImageElement>('[data-menu-image]')!;
  const error = dialog.querySelector<HTMLElement>('[data-menu-error]')!;
  const count = dialog.querySelector<HTMLElement>('[data-menu-count]')!;
  const output = dialog.querySelector<HTMLOutputElement>('[data-menu-zoom]')!;
  const close = dialog.querySelector<HTMLButtonElement>('[data-menu-close]')!;
  const zoomIn = dialog.querySelector<HTMLButtonElement>('[data-menu-zoom-in]')!;
  const zoomOut = dialog.querySelector<HTMLButtonElement>('[data-menu-zoom-out]')!;
  const html = dialog.ownerDocument.documentElement;
  let index = 0, zoom = 1, previousOverflow = '';
  let opener: HTMLButtonElement | null = null;
  let drag: { id: number; x: number; y: number; left: number; top: number } | null = null;

  function stopDrag() {
    if (drag && stage.hasPointerCapture(drag.id)) stage.releasePointerCapture(drag.id);
    drag = null;
    stage.dataset.dragging = 'false';
  }

  function layout(center = false) {
    const width = Number(triggers[index].dataset.menuWidth);
    const height = Number(triggers[index].dataset.menuHeight);
    const fit = Math.min(stage.clientWidth / width, stage.clientHeight / height, 1);
    const oldWidth = Number.parseFloat(canvas.style.width) || stage.clientWidth;
    const oldHeight = Number.parseFloat(canvas.style.height) || stage.clientHeight;
    const x = center ? 0.5 : (stage.scrollLeft + stage.clientWidth / 2) / oldWidth;
    const y = center ? 0.5 : (stage.scrollTop + stage.clientHeight / 2) / oldHeight;
    const scaledWidth = Math.round(width * fit * zoom), scaledHeight = Math.round(height * fit * zoom);
    const canvasWidth = Math.max(stage.clientWidth, scaledWidth);
    const canvasHeight = Math.max(stage.clientHeight, scaledHeight);
    image.style.width = `${scaledWidth}px`; image.style.height = `${scaledHeight}px`;
    canvas.style.width = `${canvasWidth}px`; canvas.style.height = `${canvasHeight}px`;
    stage.scrollLeft = Math.max(0, x * canvasWidth - stage.clientWidth / 2);
    stage.scrollTop = Math.max(0, y * canvasHeight - stage.clientHeight / 2);
    stage.dataset.zoomed = String(zoom > 1);
    output.value = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom === 1; zoomIn.disabled = zoom === 4;
  }

  function show(next: number) {
    stopDrag();
    index = (next + triggers.length) % triggers.length;
    zoom = 1;
    const { dataset } = triggers[index];
    stage.setAttribute('aria-busy', 'true');
    error.hidden = true; canvas.hidden = false;
    image.alt = `Menukaart ${index + 1} van ${triggers.length}`;
    image.src = dataset.menuSrc!;
    count.textContent = `${index + 1} / ${triggers.length}`;
    layout(true);
    if (image.complete && image.naturalWidth > 0) stage.setAttribute('aria-busy', 'false');
  }

  function changeZoom(next: number) {
    stopDrag();
    zoom = Math.min(4, Math.max(1, next));
    layout(zoom === 1);
  }

  triggers.forEach((trigger, position) => {
    trigger.disabled = false;
    trigger.addEventListener('click', () => {
      if (dialog.open) return;
      opener = trigger;
      previousOverflow = html.style.overflow;
      html.style.overflow = 'hidden';
      dialog.showModal();
      show(position);
      close.focus();
    });
  });
  close.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-menu-previous]')!.addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-menu-next]')!.addEventListener('click', () => show(index + 1));
  zoomIn.addEventListener('click', () => changeZoom(zoom + 0.5));
  zoomOut.addEventListener('click', () => changeZoom(zoom - 0.5));
  dialog.querySelector('[data-menu-reset]')!.addEventListener('click', () => changeZoom(1));
  dialog.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.shiftKey && event.key.startsWith('Arrow')) {
      event.preventDefault();
      stage.scrollLeft += event.key === 'ArrowLeft' ? -80 : event.key === 'ArrowRight' ? 80 : 0;
      stage.scrollTop += event.key === 'ArrowUp' ? -80 : event.key === 'ArrowDown' ? 80 : 0;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); show(index + (event.key === 'ArrowLeft' ? -1 : 1));
    } else if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault(); changeZoom(event.key === '0' ? 1 : zoom + (event.key === '-' ? -0.5 : 0.5));
    }
  });
  // Aanraken gebruikt de eigen scrollbeweging van de browser; alleen muis/pen wordt gesleept.
  stage.addEventListener('pointerdown', (event) => {
    if (zoom === 1 || event.pointerType === 'touch' || event.button !== 0) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.setPointerCapture(event.pointerId);
    stage.dataset.dragging = 'true';
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    stage.scrollLeft = drag.left + drag.x - event.clientX;
    stage.scrollTop = drag.top + drag.y - event.clientY;
  });
  stage.addEventListener('pointerup', stopDrag);
  stage.addEventListener('pointercancel', stopDrag);
  stage.addEventListener('lostpointercapture', () => { drag = null; stage.dataset.dragging = 'false'; });
  image.addEventListener('load', () => stage.setAttribute('aria-busy', 'false'));
  image.addEventListener('error', () => {
    stage.setAttribute('aria-busy', 'false'); canvas.hidden = true; error.hidden = false;
  });
  dialog.addEventListener('close', () => {
    stopDrag();
    html.style.overflow = previousOverflow;
    opener?.focus({ preventScroll: true });
  });
  dialog.ownerDocument.defaultView?.addEventListener('resize', () => { if (dialog.open) layout(); });
}
