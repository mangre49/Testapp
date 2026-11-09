import * as db from './db.js';
import {
  escapeHtml as h, fmtConsumption, fmtDate, fmtDateTime, fmtInput, fmtKm, fmtLiters, fmtMoney, fmtMonth,
  fmtPpl, fromLocalInput, toLocalInput,
} from './format.js';
import { blobToDataURL, dataURLToBlob } from './images.js';
import { readOdometer, readReceipt } from './ocr.js';
import {
  averageConsumption, isEmptyReceipt, latestKm, parseDecimal, parseInteger, rideDistance, toCSV,
} from './parsers.js';
import { $, $$, closeSheet, ICONS, openSheet, photoField, photoURL, showPhoto, toast } from './ui.js';

const state = { rides: [], fuel: [], tab: 'rides' };
const refreshers = new Set(); // offene Detailansichten, die nach Änderungen neu gezeichnet werden
let installPrompt = null;

const findRide = (id) => state.rides.find((r) => r.id === id);
const findFuel = (id) => state.fuel.find((f) => f.id === id);
const fuelOfRide = (id) => state.fuel.filter((f) => f.rideId === id).sort((a, b) => a.date.localeCompare(b.date));
const currentKm = () => latestKm(state.rides, state.fuel);

// ---------------------------------------------------------------------------
// Daten
// ---------------------------------------------------------------------------
async function load() {
  const [rides, fuel] = await Promise.all([db.getAll('rides'), db.getAll('fuel')]);
  state.rides = rides.sort((a, b) => b.date.localeCompare(a.date));
  state.fuel = fuel.sort((a, b) => b.date.localeCompare(a.date));
}

async function changed() {
  await load();
  render();
  refreshers.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Hauptansichten
// ---------------------------------------------------------------------------
const TABS = {
  rides: { title: 'Fahrten', fab: 'Neue Fahrt', render: renderRides, add: () => rideForm() },
  fuel: { title: 'Tanken', fab: 'Tankstopp', render: renderFuel, add: () => fuelForm() },
  stats: { title: 'Statistik', fab: null, render: renderStats },
};

function render() {
  const tab = TABS[state.tab];
  $('#title').textContent = tab.title;
  $('#view').innerHTML = tab.render();
  $$('.tabbar button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false'));
  const fab = $('#fab');
  fab.hidden = !tab.fab;
  if (tab.fab) $('span', fab).textContent = tab.fab;
}

function groupByMonth(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()];
}

function thumb(blob, icon) {
  return blob
    ? `<span class="thumb"><img src="${photoURL(blob)}" alt="" loading="lazy"></span>`
    : `<span class="thumb empty">${icon}</span>`;
}

function emptyState(icon, title, text, buttonLabel) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <h2>${title}</h2><p>${text}</p>
    <button class="primary-btn" data-action="add">${buttonLabel}</button>
  </div>`;
}

function installBanner() {
  const dismissed = (() => { try { return localStorage.getItem('installHintDismissed'); } catch { return '1'; } })();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (dismissed || standalone) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!ios && !installPrompt) return '';
  return `<div class="banner">
    <div><strong>Als App installieren</strong><br>
    ${ios ? 'In Safari auf <b>Teilen</b> ⬆︎ und dann <b>„Zum Home-Bildschirm“</b> tippen.'
          : 'MotoLog auf den Startbildschirm legen – startet wie eine normale App.'}</div>
    ${installPrompt ? '<button class="primary-btn small" data-action="install">Installieren</button>' : ''}
    <button class="banner-close" data-action="dismiss-install" aria-label="Hinweis schließen">×</button>
  </div>`;
}

function renderRides() {
  if (!state.rides.length) {
    return installBanner() + emptyState(ICONS.gauge, 'Noch keine Fahrten',
      'Fotografiere vor der Abfahrt deinen Tacho – der Kilometerstand wird automatisch erkannt.', 'Erste Fahrt anlegen');
  }
  return installBanner() + groupByMonth(state.rides).map((rides) => {
    const km = rides.reduce((sum, r) => sum + (rideDistance(r) ?? 0), 0);
    return `<section class="list-group">
      <h3 class="list-head"><span>${fmtMonth(rides[0].date)}</span><span>${km ? fmtKm(km) : ''}</span></h3>
      <div class="list">${rides.map((r) => {
        const d = rideDistance(r);
        return `<button class="item" data-ride="${r.id}">
          ${thumb(r.endPhoto ?? r.startPhoto, ICONS.gauge)}
          <span class="item-main"><strong>${h(r.title || 'Ausfahrt')}</strong>
            <small>${fmtDate(r.date)}${fuelOfRide(r.id).length ? ' · ⛽️ ' + fuelOfRide(r.id).length : ''}</small></span>
          ${d != null ? `<span class="item-value">${fmtKm(d)}</span>` : '<span class="badge">unterwegs</span>'}
          ${ICONS.chevron}
        </button>`;
      }).join('')}</div>
    </section>`;
  }).join('');
}

function renderFuel() {
  if (!state.fuel.length) {
    return emptyState(ICONS.fuel, 'Noch nicht getankt',
      'Fotografiere die Tankquittung – Liter, Betrag und Literpreis werden automatisch übernommen.', 'Tankstopp erfassen');
  }
  return groupByMonth(state.fuel).map((stops) => {
    const cost = stops.reduce((sum, f) => sum + (f.total ?? 0), 0);
    return `<section class="list-group">
      <h3 class="list-head"><span>${fmtMonth(stops[0].date)}</span><span>${cost ? fmtMoney(cost) : ''}</span></h3>
      <div class="list">${stops.map((f) => `<button class="item" data-fuel="${f.id}">
          ${thumb(f.receiptPhoto, ICONS.receipt)}
          <span class="item-main"><strong>${h(f.station || 'Tankstopp')}</strong>
            <small>${fmtDate(f.date)}${f.km != null ? ' · ' + fmtKm(f.km) : ''}</small></span>
          <span class="item-value">${f.total != null ? fmtMoney(f.total) : ''}
            <small>${f.liters != null ? fmtLiters(f.liters) : ''}</small></span>
          ${ICONS.chevron}
        </button>`).join('')}</div>
    </section>`;
  }).join('');
}

function computeStats() {
  const distances = state.rides.map(rideDistance).filter((d) => d != null);
  const paired = state.fuel.filter((f) => f.liters != null && f.total != null);
  const pairedLiters = paired.reduce((s, f) => s + f.liters, 0);
  const consumption = averageConsumption(state.fuel.map((f) => ({ km: f.km, liters: f.liters, full: f.full })));
  const ppl = pairedLiters > 0 ? paired.reduce((s, f) => s + f.total, 0) / pairedLiters : null;
  return {
    rides: state.rides.length,
    distance: distances.reduce((a, b) => a + b, 0),
    longest: distances.length ? Math.max(...distances) : null,
    km: currentKm(),
    stops: state.fuel.length,
    liters: state.fuel.reduce((s, f) => s + (f.liters ?? 0), 0),
    cost: state.fuel.reduce((s, f) => s + (f.total ?? 0), 0),
    ppl,
    consumption,
    per100: consumption != null && ppl != null ? consumption * ppl : null,
  };
}

function renderStats() {
  const s = computeStats();
  const card = (label, value, accent = false) => `<div class="stat${accent ? ' accent' : ''}">
    <small>${label}</small><strong>${value}</strong></div>`;
  return `
    <h3 class="section-title">Fahrten</h3>
    <div class="stats">
      ${card('Gesamtstrecke', fmtKm(s.distance), true)}
      ${card('Fahrten', s.rides)}
      ${card('Längste Fahrt', s.longest != null ? fmtKm(s.longest) : '–')}
      ${card('Tachostand', s.km != null ? fmtKm(s.km) : '–')}
    </div>
    <h3 class="section-title">Tanken</h3>
    <div class="stats">
      ${card('Ø Verbrauch', s.consumption != null ? fmtConsumption(s.consumption) : '–', true)}
      ${card('Tankkosten', fmtMoney(s.cost))}
      ${card('Getankt', fmtLiters(s.liters))}
      ${card('Ø Literpreis', s.ppl != null ? fmtPpl(s.ppl) : '–')}
      ${card('Sprit / 100 km', s.per100 != null ? fmtMoney(s.per100) : '–')}
      ${card('Tankstopps', s.stops)}
    </div>
    ${s.consumption == null ? '<p class="hint">Für den Verbrauch mindestens zweimal <b>vollgetankt</b> mit Kilometerstand erfassen.</p>' : ''}
    <h3 class="section-title">Daten</h3>
    <div class="list">
      <button class="item" data-action="export-rides"><span class="item-main"><strong>Fahrten als CSV</strong><small>für Excel, Numbers, LibreOffice</small></span>${ICONS.chevron}</button>
      <button class="item" data-action="export-fuel"><span class="item-main"><strong>Tankstopps als CSV</strong><small>für Excel, Numbers, LibreOffice</small></span>${ICONS.chevron}</button>
      <button class="item" data-action="menu"><span class="item-main"><strong>Sicherung & Einstellungen</strong><small>Backup mit Fotos, Wiederherstellen</small></span>${ICONS.chevron}</button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Fahrt: Detail & Formular
// ---------------------------------------------------------------------------
function rideDetail(id) {
  const sheet = openSheet({ title: 'Fahrt', body: '<div data-detail></div>' });
  const draw = () => {
    const r = findRide(id);
    if (!r) return;
    const d = rideDistance(r);
    const stops = fuelOfRide(id);
    $('[data-detail]', sheet).innerHTML = `
      <div class="hero">
        <small>${fmtDateTime(r.date)}</small>
        <h2>${h(r.title || 'Ausfahrt')}</h2>
        <div class="hero-value">${d != null ? fmtKm(d) : 'unterwegs'}</div>
      </div>
      ${d == null ? '<button class="primary-btn wide" data-edit>Fahrt beenden – Tacho fotografieren</button>' : ''}
      <div class="group">
        <div class="row"><span>Start</span><b>${r.startKm != null ? fmtKm(r.startKm) : '–'}</b></div>
        <div class="row"><span>Ziel</span><b>${r.endKm != null ? fmtKm(r.endKm) : '–'}</b></div>
      </div>
      ${r.startPhoto || r.endPhoto ? `<h3 class="section-title">Tachofotos</h3><div class="photos">
        ${[['Start', r.startPhoto, 'start'], ['Ziel', r.endPhoto, 'end']].filter(([, b]) => b).map(([label, b, key]) => `
          <button class="photo-tile" data-photo="${key}"><img src="${photoURL(b)}" alt="Tacho ${label}"><span>${label}</span></button>`).join('')}
      </div>` : ''}
      <h3 class="section-title">Tankstopps</h3>
      <div class="list">
        ${stops.map((f) => `<button class="item" data-fuel="${f.id}">
          ${thumb(f.receiptPhoto, ICONS.receipt)}
          <span class="item-main"><strong>${h(f.station || 'Tankstopp')}</strong><small>${fmtDate(f.date)}</small></span>
          <span class="item-value">${f.total != null ? fmtMoney(f.total) : ''}<small>${f.liters != null ? fmtLiters(f.liters) : ''}</small></span>
        </button>`).join('')}
        <button class="item add" data-add-fuel>${ICONS.fuel}<span class="item-main"><strong>Tankstopp hinzufügen</strong></span></button>
      </div>
      ${r.notes ? `<h3 class="section-title">Notizen</h3><div class="group notes">${h(r.notes)}</div>` : ''}
      <button class="secondary-btn wide" data-edit>Bearbeiten</button>`;

    $$('[data-edit]', sheet).forEach((b) => b.addEventListener('click', () => rideForm(r)));
    $$('[data-photo]', sheet).forEach((b) => b.addEventListener('click', () => showPhoto(b.dataset.photo === 'start' ? r.startPhoto : r.endPhoto)));
    $$('[data-fuel]', sheet).forEach((b) => b.addEventListener('click', () => fuelForm(findFuel(b.dataset.fuel))));
    $('[data-add-fuel]', sheet).addEventListener('click', () => fuelForm(null, id));
  };
  refreshers.add(draw);
  sheet.addEventListener('sheetclosed', () => refreshers.delete(draw));
  draw();
}

function kmInput(name, value) {
  return `<label class="field"><span>Kilometerstand</span>
    <span class="unit-input"><input name="${name}" inputmode="numeric" pattern="[0-9.]*" autocomplete="off"
      placeholder="0" value="${value ?? ''}"><em>km</em></span></label>`;
}

async function detectKm(blob, field, input, minimum) {
  field.setStatus('Texterkennung wird vorbereitet …', 'busy');
  try {
    const km = await readOdometer(blob, minimum, (text) => field.setStatus(text, 'busy'));
    if (km == null) {
      field.setStatus('Kein Kilometerstand erkannt – bitte eintippen.', 'warn');
    } else {
      input.value = km;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flash(input);
      field.setStatus(`Erkannt: ${fmtKm(km)} – bitte kurz prüfen.`, 'ok');
    }
  } catch (error) {
    field.setStatus(error.message || 'Texterkennung fehlgeschlagen.', 'warn');
  }
}

function flash(input) {
  input.classList.remove('flash');
  void input.offsetWidth;
  input.classList.add('flash');
}

function rideForm(ride = null) {
  const isNew = !ride;
  const r = ride ?? {
    id: db.newId(), date: new Date().toISOString(), title: '', startKm: currentKm(), endKm: null, notes: '',
    startPhoto: null, endPhoto: null,
  };
  let startPhoto;
  let endPhoto;

  openSheet({
    title: isNew ? 'Neue Fahrt' : 'Fahrt bearbeiten',
    body: `<form class="form" novalidate>
      <div class="group">
        <label class="field"><span>Titel</span><input name="title" placeholder="z. B. Schwarzwald-Runde" value="${h(r.title)}"></label>
        <label class="field"><span>Datum</span><input name="date" type="datetime-local" value="${toLocalInput(r.date)}"></label>
      </div>
      <h3 class="section-title">Start</h3>
      <div class="group"><div data-photo="start"></div>${kmInput('startKm', r.startKm)}</div>
      <h3 class="section-title">Ziel</h3>
      <div class="group"><div data-photo="end"></div>${kmInput('endKm', r.endKm)}</div>
      <div class="distance" data-distance></div>
      <h3 class="section-title">Notizen</h3>
      <div class="group"><textarea name="notes" rows="4" placeholder="Route, Wetter, Erlebnisse …">${h(r.notes)}</textarea></div>
      ${isNew ? '' : '<button type="button" class="danger-btn wide" data-delete>Fahrt löschen</button>'}
    </form>`,
    onOpen(sheet) {
      const form = $('form', sheet);
      const updateDistance = () => {
        const s = parseInteger(form.startKm.value);
        const e = parseInteger(form.endKm.value);
        const box = $('[data-distance]', sheet);
        if (s == null || e == null) box.innerHTML = '';
        else if (e < s) box.innerHTML = '<span class="warn">⚠︎ Ziel-Kilometerstand ist kleiner als der Start.</span>';
        else box.innerHTML = `Gefahrene Strecke <b>${fmtKm(e - s)}</b>`;
      };
      startPhoto = photoField($('[data-photo=start]', sheet), {
        label: 'Tachofoto bei Abfahrt',
        blob: r.startPhoto,
        onImage: (blob) => detectKm(blob, startPhoto, form.startKm, isNew ? currentKm() : null),
      });
      endPhoto = photoField($('[data-photo=end]', sheet), {
        label: 'Tachofoto bei Ankunft',
        blob: r.endPhoto,
        onImage: (blob) => detectKm(blob, endPhoto, form.endKm, parseInteger(form.startKm.value)),
      });
      form.addEventListener('input', updateDistance);
      form.addEventListener('submit', (e) => e.preventDefault());
      updateDistance();

      $('[data-delete]', sheet)?.addEventListener('click', async () => {
        if (!confirm('Diese Fahrt wirklich löschen? Zugeordnete Tankstopps bleiben erhalten.')) return;
        await db.remove('rides', r.id);
        for (const f of fuelOfRide(r.id)) await db.put('fuel', { ...f, rideId: null });
        closeSheet(2); // Formular + Detailansicht
        await changed();
        toast('Fahrt gelöscht');
      });
    },
    async onSave(sheet) {
      const form = $('form', sheet);
      const startKm = parseInteger(form.startKm.value);
      const endKm = parseInteger(form.endKm.value);
      if (startKm != null && endKm != null && endKm < startKm
        && !confirm('Der Ziel-Kilometerstand ist kleiner als der Start. Trotzdem speichern?')) return false;
      await db.put('rides', {
        ...r,
        title: form.title.value.trim(),
        date: fromLocalInput(form.date.value),
        startKm,
        endKm,
        notes: form.notes.value.trim(),
        startPhoto: startPhoto.get(),
        endPhoto: endPhoto.get(),
      });
      await changed();
      toast(isNew ? 'Fahrt gespeichert 🏍️' : 'Änderungen gespeichert');
      return true;
    },
  });
}

// ---------------------------------------------------------------------------
// Tankstopp-Formular
// ---------------------------------------------------------------------------
function fuelForm(stop = null, presetRideId = null) {
  const isNew = !stop;
  const f = stop ?? {
    id: db.newId(), date: new Date().toISOString(), station: '', liters: null, total: null, km: null, full: true,
    notes: '', rideId: presetRideId, receiptPhoto: null, kmPhoto: null,
  };
  let receipt;
  let kmPhoto;
  const rideOptions = state.rides.map((r) => `<option value="${r.id}" ${r.id === f.rideId ? 'selected' : ''}>
    ${h(r.title || 'Ausfahrt')} · ${fmtDate(r.date)}</option>`).join('');

  openSheet({
    title: isNew ? 'Tankstopp' : 'Tankstopp bearbeiten',
    body: `<form class="form" novalidate>
      <h3 class="section-title">Tankquittung</h3>
      <div class="group"><div data-photo="receipt"></div></div>
      <h3 class="section-title">Tankvorgang</h3>
      <div class="group">
        <label class="field"><span>Datum</span><input name="date" type="datetime-local" value="${toLocalInput(f.date)}"></label>
        <label class="field"><span>Tankstelle</span><input name="station" placeholder="z. B. Aral" value="${h(f.station)}"></label>
        <label class="field"><span>Menge</span><span class="unit-input"><input name="liters" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${fmtInput(f.liters)}"><em>l</em></span></label>
        <label class="field"><span>Betrag</span><span class="unit-input"><input name="total" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${fmtInput(f.total)}"><em>€</em></span></label>
        <div class="row" data-ppl hidden><span>Preis pro Liter</span><b></b></div>
        <label class="field switch"><span>Vollgetankt</span><input name="full" type="checkbox" ${f.full ? 'checked' : ''}><i></i></label>
      </div>
      <h3 class="section-title">Tacho</h3>
      <div class="group"><div data-photo="km"></div>${kmInput('km', f.km)}</div>
      <p class="hint">Mit Kilometerstand und „Vollgetankt“ berechnet MotoLog deinen Verbrauch.</p>
      <h3 class="section-title">Zuordnung</h3>
      <div class="group">
        <label class="field"><span>Fahrt</span><select name="rideId"><option value="">Keine</option>${rideOptions}</select></label>
        <label class="field"><span>Notiz</span><input name="notes" placeholder="optional" value="${h(f.notes)}"></label>
      </div>
      ${isNew ? '' : '<button type="button" class="danger-btn wide" data-delete>Tankstopp löschen</button>'}
    </form>`,
    onOpen(sheet) {
      const form = $('form', sheet);
      const updatePpl = () => {
        const l = parseDecimal(form.liters.value);
        const t = parseDecimal(form.total.value);
        const row = $('[data-ppl]', sheet);
        row.hidden = !(l > 0 && t != null);
        if (!row.hidden) $('b', row).textContent = fmtPpl(t / l);
      };
      form.addEventListener('input', updatePpl);
      form.addEventListener('submit', (e) => e.preventDefault());
      updatePpl();

      receipt = photoField($('[data-photo=receipt]', sheet), {
        label: 'Foto der Quittung – Werte werden automatisch gelesen',
        blob: f.receiptPhoto,
        async onImage(blob) {
          receipt.setStatus('Texterkennung wird vorbereitet …', 'busy');
          try {
            const data = await readReceipt(blob, (text) => receipt.setStatus(text, 'busy'));
            if (isEmptyReceipt(data)) {
              receipt.setStatus('Keine Werte erkannt – bitte eintippen.', 'warn');
              return;
            }
            const found = [];
            if (data.liters != null) { form.liters.value = fmtInput(data.liters); flash(form.liters); found.push('Menge'); }
            if (data.totalPrice != null) { form.total.value = fmtInput(data.totalPrice); flash(form.total); found.push('Betrag'); }
            if (data.date) {
              form.date.value = `${data.date}T${(form.date.value.split('T')[1] || '12:00')}`;
              found.push('Datum');
            }
            if (data.station && !form.station.value) { form.station.value = data.station; found.push('Tankstelle'); }
            updatePpl();
            const missing = data.liters == null || data.totalPrice == null;
            receipt.setStatus(`Erkannt: ${found.join(', ')}${missing ? ' – bitte Rest ergänzen.' : ' – bitte kurz prüfen.'}`, missing ? 'warn' : 'ok');
          } catch (error) {
            receipt.setStatus(error.message || 'Texterkennung fehlgeschlagen.', 'warn');
          }
        },
      });
      kmPhoto = photoField($('[data-photo=km]', sheet), {
        label: 'Tachofoto (optional)',
        blob: f.kmPhoto,
        onImage: (blob) => detectKm(blob, kmPhoto, form.km, isNew ? currentKm() : null),
      });

      $('[data-delete]', sheet)?.addEventListener('click', async () => {
        if (!confirm('Diesen Tankstopp wirklich löschen?')) return;
        await db.remove('fuel', f.id);
        closeSheet();
        await changed();
        toast('Tankstopp gelöscht');
      });
    },
    async onSave(sheet) {
      const form = $('form', sheet);
      await db.put('fuel', {
        ...f,
        date: fromLocalInput(form.date.value),
        station: form.station.value.trim(),
        liters: parseDecimal(form.liters.value),
        total: parseDecimal(form.total.value),
        km: parseInteger(form.km.value),
        full: form.full.checked,
        rideId: form.rideId.value || null,
        notes: form.notes.value.trim(),
        receiptPhoto: receipt.get(),
        kmPhoto: kmPhoto.get(),
      });
      await changed();
      toast(isNew ? 'Tankstopp gespeichert ⛽️' : 'Änderungen gespeichert');
      return true;
    },
  });
}

// ---------------------------------------------------------------------------
// Export, Sicherung, Einstellungen
// ---------------------------------------------------------------------------
async function saveFile(name, blob) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const stamp = () => new Date().toISOString().slice(0, 10);
const csvBlob = (rows) => new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8' });

function exportRides() {
  const rows = [['Datum', 'Titel', 'Start km', 'Ziel km', 'Strecke km', 'Tankstopps', 'Notizen']];
  for (const r of [...state.rides].reverse()) {
    rows.push([fmtDateTime(r.date), r.title || 'Ausfahrt', r.startKm, r.endKm, rideDistance(r),
      fuelOfRide(r.id).length, r.notes]);
  }
  return saveFile(`MotoLog-Fahrten-${stamp()}.csv`, csvBlob(rows));
}

function exportFuel() {
  const rows = [['Datum', 'Tankstelle', 'Liter', 'Betrag €', 'Preis/l €', 'km-Stand', 'Volltank', 'Fahrt', 'Notiz']];
  for (const f of [...state.fuel].reverse()) {
    rows.push([fmtDateTime(f.date), f.station, fmtInput(f.liters), fmtInput(f.total),
      f.liters > 0 && f.total != null ? fmtInput(f.total / f.liters, 3) : '', f.km, f.full ? 'ja' : 'nein',
      findRide(f.rideId)?.title ?? '', f.notes]);
  }
  return saveFile(`MotoLog-Tanken-${stamp()}.csv`, csvBlob(rows));
}

const PHOTO_KEYS = ['startPhoto', 'endPhoto', 'receiptPhoto', 'kmPhoto'];

async function serialize(item) {
  const out = { ...item };
  for (const key of PHOTO_KEYS) if (out[key] instanceof Blob) out[key] = await blobToDataURL(out[key]);
  return out;
}

async function deserialize(item) {
  const out = { ...item };
  for (const key of PHOTO_KEYS) if (typeof out[key] === 'string') out[key] = await dataURLToBlob(out[key]);
  return out;
}

async function backup() {
  toast('Sicherung wird erstellt …');
  const data = {
    app: 'MotoLog', version: 1, exported: new Date().toISOString(),
    rides: await Promise.all(state.rides.map(serialize)),
    fuel: await Promise.all(state.fuel.map(serialize)),
  };
  await saveFile(`MotoLog-Sicherung-${stamp()}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
}

async function restore(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'MotoLog' || !Array.isArray(data.rides) || !Array.isArray(data.fuel)) throw new Error();
    if (!confirm(`Sicherung vom ${fmtDate(data.exported)} mit ${data.rides.length} Fahrten und ${data.fuel.length} Tankstopps einspielen? Vorhandene Einträge mit gleicher ID werden überschrieben.`)) return;
    for (const r of data.rides) await db.put('rides', await deserialize(r));
    for (const f of data.fuel) await db.put('fuel', await deserialize(f));
    await changed();
    toast('Sicherung wiederhergestellt ✅');
  } catch {
    toast('Diese Datei ist keine gültige MotoLog-Sicherung.');
  }
}

async function openMenu() {
  let usage = '';
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage != null) usage = `${(est.usage / 1024 / 1024).toFixed(1).replace('.', ',')} MB belegt`;
  } catch { /* egal */ }
  const persisted = await navigator.storage?.persisted?.().catch(() => false);

  openSheet({
    title: 'Sicherung & Einstellungen',
    body: `
      <p class="hint">Deine Daten und Fotos liegen <b>nur auf diesem Handy</b>. Erstelle regelmäßig eine Sicherung
        (z. B. in iCloud Drive, Google Drive oder per Mail an dich selbst).</p>
      <div class="list">
        <button class="item" data-act="backup"><span class="item-main"><strong>Sicherung erstellen</strong><small>alle Fahrten, Tankstopps und Fotos (JSON)</small></span>${ICONS.chevron}</button>
        <label class="item"><span class="item-main"><strong>Sicherung wiederherstellen</strong><small>JSON-Datei auswählen</small></span>${ICONS.chevron}
          <input type="file" accept="application/json,.json" hidden data-act="restore"></label>
        <button class="item" data-act="export-rides"><span class="item-main"><strong>Fahrten als CSV</strong></span>${ICONS.chevron}</button>
        <button class="item" data-act="export-fuel"><span class="item-main"><strong>Tankstopps als CSV</strong></span>${ICONS.chevron}</button>
      </div>
      <h3 class="section-title">Speicher</h3>
      <div class="group">
        <div class="row"><span>Belegt</span><b>${usage || '–'}</b></div>
        <div class="row"><span>Dauerhaft gespeichert</span><b>${persisted ? 'ja' : 'nicht garantiert'}</b></div>
      </div>
      ${persisted ? '' : '<p class="hint">Tipp: Als App auf dem Home-Bildschirm installiert bleiben die Daten zuverlässiger erhalten.</p>'}
      <h3 class="section-title">Über</h3>
      <div class="group"><div class="row"><span>MotoLog</span><b>Version 1.0</b></div></div>
      <button class="danger-btn wide" data-act="wipe">Alle Daten löschen</button>`,
    onOpen(sheet) {
      $('[data-act=backup]', sheet).addEventListener('click', backup);
      $('[data-act=export-rides]', sheet).addEventListener('click', exportRides);
      $('[data-act=export-fuel]', sheet).addEventListener('click', exportFuel);
      $('[data-act=restore]', sheet).addEventListener('change', (e) => e.target.files[0] && restore(e.target.files[0]));
      $('[data-act=wipe]', sheet).addEventListener('click', async () => {
        if (!confirm('Wirklich ALLE Fahrten, Tankstopps und Fotos löschen? Das kann nicht rückgängig gemacht werden.')) return;
        await db.clear('rides');
        await db.clear('fuel');
        closeSheet();
        await changed();
        toast('Alle Daten gelöscht');
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
function bindEvents() {
  $('.tabbar').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-tab]');
    if (!button) return;
    state.tab = button.dataset.tab;
    render();
    window.scrollTo({ top: 0 });
  });
  $('#fab').addEventListener('click', () => TABS[state.tab].add?.());
  $('#menuBtn').addEventListener('click', openMenu);

  $('#view').addEventListener('click', async (e) => {
    const target = e.target.closest('[data-ride],[data-fuel],[data-action]');
    if (!target) return;
    if (target.dataset.ride) return rideDetail(target.dataset.ride);
    if (target.dataset.fuel) return fuelForm(findFuel(target.dataset.fuel));
    switch (target.dataset.action) {
      case 'add': return TABS[state.tab].add?.();
      case 'export-rides': return exportRides();
      case 'export-fuel': return exportFuel();
      case 'menu': return openMenu();
      case 'install':
        installPrompt?.prompt();
        installPrompt = null;
        return render();
      case 'dismiss-install':
        try { localStorage.setItem('installHintDismissed', '1'); } catch { /* egal */ }
        return render();
      default:
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    render();
  });
}

async function start() {
  bindEvents();
  try {
    await load();
  } catch {
    toast('Speicher nicht verfügbar – im privaten Modus werden keine Daten gespeichert.');
  }
  render();
  db.requestPersistence();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

start();
