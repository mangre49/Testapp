// Wiederverwendbare Bausteine: Vollbild-Dialoge, Hinweise, Fotofelder.
import { escapeHtml } from './format.js';
import { compressPhoto } from './images.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const ICONS = {
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  gauge: '<svg viewBox="0 0 24 24"><path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-6"/></svg>',
  receipt: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  fuel: '<svg viewBox="0 0 24 24"><path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M6 9h7"/><path d="M14 8l3 2v7a1.5 1.5 0 0 0 3 0V8l-3-3"/></svg>',
};

// --- Hinweise --------------------------------------------------------------
let toastTimer;
export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// --- Vollbild-Dialoge (Zurück-Taste unter Android schließt sie) -----------
const stack = [];

export function openSheet({ title, body, saveLabel, onSave, onOpen }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.innerHTML = `
    <header class="sheet-bar">
      <button class="bar-btn" data-close>${onSave ? 'Abbrechen' : 'Zurück'}</button>
      <h2>${escapeHtml(title)}</h2>
      ${onSave ? `<button class="bar-btn strong" data-save>${escapeHtml(saveLabel ?? 'Sichern')}</button>` : '<span class="bar-spacer"></span>'}
    </header>
    <div class="sheet-body">${body}</div>`;
  document.body.append(sheet);
  document.body.classList.add('has-sheet');
  requestAnimationFrame(() => sheet.classList.add('open'));

  stack.push(sheet);
  history.pushState({ sheet: stack.length }, '');

  $('[data-close]', sheet).addEventListener('click', () => closeSheet());
  $('[data-save]', sheet)?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if ((await onSave(sheet)) !== false) closeSheet();
    } finally {
      button.disabled = false;
    }
  });
  onOpen?.(sheet);
  return sheet;
}

/** Schließt die obersten `count` Dialoge. */
export function closeSheet(count = 1) {
  const n = Math.min(count, stack.length);
  if (n > 0) history.go(-n);
}

window.addEventListener('popstate', (event) => {
  const target = event.state?.sheet ?? 0;
  while (stack.length > target) {
    const sheet = stack.pop();
    sheet.classList.remove('open');
    setTimeout(() => sheet.remove(), 250);
    sheet.dispatchEvent(new CustomEvent('sheetclosed'));
  }
  if (!stack.length) document.body.classList.remove('has-sheet');
});

// --- Fotos ----------------------------------------------------------------
const urlCache = new WeakMap();
export function photoURL(blob) {
  if (!blob) return null;
  if (!urlCache.has(blob)) urlCache.set(blob, URL.createObjectURL(blob));
  return urlCache.get(blob);
}

export function showPhoto(blob) {
  if (!blob) return;
  openSheet({
    title: 'Foto',
    body: `<div class="viewer"><img src="${photoURL(blob)}" alt="Foto"></div>`,
  });
}

/**
 * Fotofeld mit Kamera/Galerie, Vorschau und Status für die Texterkennung.
 * @returns {{ get(): Blob|null, setStatus(text, kind) }}
 */
export function photoField(container, { label, blob = null, onImage }) {
  let current = blob;
  container.classList.add('photo-field');
  container.innerHTML = `
    <div class="photo-label">${escapeHtml(label)}</div>
    <button type="button" class="photo-preview" aria-label="Foto ansehen"></button>
    <div class="photo-actions">
      <label class="chip">${ICONS.camera}<span>Kamera</span>
        <input type="file" accept="image/*" capture="environment" hidden></label>
      <label class="chip">${ICONS.image}<span>Galerie</span>
        <input type="file" accept="image/*" hidden></label>
      <button type="button" class="chip danger" data-remove aria-label="Foto entfernen">${ICONS.trash}</button>
    </div>
    <div class="ocr-status" aria-live="polite"></div>`;

  const preview = $('.photo-preview', container);
  const removeBtn = $('[data-remove]', container);
  const status = $('.ocr-status', container);

  const render = () => {
    preview.innerHTML = current
      ? `<img src="${photoURL(current)}" alt="">`
      : `<span class="placeholder">${ICONS.camera}Foto aufnehmen</span>`;
    preview.classList.toggle('empty', !current);
    removeBtn.hidden = !current;
  };
  render();

  preview.addEventListener('click', () => (current ? showPhoto(current) : $('input[capture]', container).click()));
  removeBtn.addEventListener('click', () => {
    current = null;
    status.textContent = '';
    render();
  });

  for (const input of $$('input[type=file]', container)) {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      current = await compressPhoto(file);
      render();
      onImage?.(current);
    });
  }

  return {
    get: () => current,
    setStatus(text, kind = '') {
      status.textContent = text;
      status.className = `ocr-status ${kind}`;
    },
  };
}
