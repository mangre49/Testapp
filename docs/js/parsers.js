// Reine Logik ohne Browser-Abhängigkeiten – wird auch in Node getestet.

/** "45,23" / "45.23" / "1.234,56" / "1,234.56" → Zahl */
export function parseDecimal(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (comma >= 0) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "12.345" → 12345 (Tausendertrenner werden ignoriert) */
export function parseInteger(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
}

export const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

function allMatches(regex, text) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  return [...String(text).matchAll(new RegExp(regex.source, flags))];
}

// ---------------------------------------------------------------------------
// Zeilen bilden: Textstücke auf gleicher Höhe zusammenfassen
// items: { text, x, y, height } – normiert 0…1, y von oben gemessen
// ---------------------------------------------------------------------------
export function groupLines(items) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const groups = [];
  for (const item of sorted) {
    const anchor = groups.at(-1)?.[0];
    if (anchor && Math.abs(anchor.y - item.y) < Math.max(anchor.height, item.height) * 0.5) {
      groups.at(-1).push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups.map((g) => g.sort((a, b) => a.x - b.x).map((i) => i.text).join('  '));
}

// ---------------------------------------------------------------------------
// Kilometerstand vom Tacho
// ---------------------------------------------------------------------------
const CONFUSABLES = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', i: '1', '|': '1',
  S: '5', s: '5', B: '8', Z: '2', z: '2', G: '6' };

/** Typische OCR-Verwechsler in überwiegend numerischen Wörtern korrigieren */
export function normalizeConfusables(text) {
  return String(text).split(' ').map((word) => {
    const digits = (word.match(/\d/g) || []).length;
    if (word.length < 3 || digits / word.length < 0.5) return word;
    return [...word].map((ch) => CONFUSABLES[ch] ?? ch).join('');
  }).join(' ');
}

/**
 * @param items  [{ text, height }] – height relativ zur Bildhöhe (0…1)
 * @param minimum zuletzt bekannter Kilometerstand (optional)
 */
export function odometerCandidates(items, minimum = null) {
  const out = [];
  for (const item of items) {
    const lower = item.text.toLowerCase();
    const isScale = ['km/h', 'mph', 'rpm', 'x1000', '1/min'].some((k) => lower.includes(k));
    const cleaned = normalizeConfusables(item.text);
    const tokens = cleaned.match(/\d{1,3}(?:[ .'’]\d{3})+(?!\d)|\d+(?:[.,]\d+)?/g) || [];

    for (const token of tokens) {
      if (/[.,]\d{1,2}$/.test(token)) continue; // Tageskilometer wie "123.4"
      const digits = token.replace(/\D/g, '');
      if (digits.length < 3 || digits.length > 7) continue;
      const value = parseInt(digits, 10);

      let score = digits.length * 10 + (item.height || 0) * 100;
      if (digits.length >= 5) score += 10;
      if (lower.includes('km') && !isScale) score += 15;
      if (lower.includes('trip')) score -= 25;
      if (isScale) score -= 30;
      if (tokens.length >= 3) score -= 30; // Skala wie "20 40 60 80"
      if (minimum != null) {
        if (value < minimum) score -= 50;
        else if (value - minimum <= 5000) score += 20;
      }
      out.push({ value, score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export const bestOdometer = (items, minimum = null) => odometerCandidates(items, minimum)[0]?.value ?? null;

// ---------------------------------------------------------------------------
// Tankquittung
// ---------------------------------------------------------------------------
export const BRANDS = ['TotalEnergies', 'Raiffeisen', 'Westfalen', 'Circle K', 'Tamoil', 'Texaco', 'Turmöl',
  'Migrol', 'Socar', 'Orlen', 'Shell', 'Agip', 'Aral', 'Esso', 'Avia', 'Total', 'JET', 'OMV', 'Eni', 'HEM',
  'Star', 'bft', 'BP', 'Q8', 'Repsol', 'Cepsa', 'Galp', 'Lukoil', 'MOL'];

const UNIT = '(?:liter|litre|ltr|lt|l)\\b';
const NOT_NUM = '(?:^|[^\\d.,])'; // ersetzt Lookbehind (ältere Safari-Versionen)

// "15,42 l x 1,859" – auch wenn die OCR das "l" als "1" liest
const QTY_TIMES_PRICE = `${NOT_NUM}(\\d{1,3}[.,]\\d{2,3})[ \\t]*(?:liter|ltr|lt|l|1)?[ \\t]*[x×*][ \\t]*(\\d[.,]\\d{3})(?!\\d)`;

function qtyTimesPrice(text) {
  for (const m of allMatches(new RegExp(QTY_TIMES_PRICE, 'gim'), text)) {
    const liters = parseDecimal(m[1]);
    const price = parseDecimal(m[2]);
    if (liters >= 0.3 && liters <= 150 && price >= 0.3 && price <= 5) return { liters, price };
  }
  return null;
}

function litersFrom(lines, text) {
  const pair = qtyTimesPrice(text);
  if (pair) return pair.liters;

  const direct = allMatches(new RegExp(`${NOT_NUM}(\\d{1,3}[.,]\\d{1,3})[ \\t]*${UNIT}`, 'gim'), text)
    .map((m) => parseDecimal(m[1])).find((v) => v >= 0.3 && v <= 150);
  if (direct != null) return direct;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!['menge', 'liter', 'abgabe', 'volumen'].some((k) => lower.includes(k))) continue;
    if (lower.includes('/l') || lower.includes('preis')) continue;
    const v = allMatches(new RegExp(`${NOT_NUM}(\\d{1,3}[.,]\\d{2,3})(?!\\d)`, 'g'), line)
      .map((m) => parseDecimal(m[1])).find((x) => x >= 0.3 && x <= 150);
    if (v != null) return v;
  }
  return null;
}

function pricePerLiterFrom(lines, text) {
  const pair = qtyTimesPrice(text);
  if (pair) return pair.price;

  const direct = allMatches(
    new RegExp(`${NOT_NUM}(\\d[.,]\\d{2,3})[ \\t]*(?:eur|€)?[ \\t]*\\/[ \\t]*(?:liter|litre|ltr|lt|l|1)(?![\\d\\p{L}])`, 'gimu'), text,
  ).map((m) => parseDecimal(m[1])).find((v) => v >= 0.3 && v <= 5);
  if (direct != null) return direct;

  const keys = ['preis/l', 'eur/l', '€/l', 'literpreis', 'preis je l', 'pro liter', 'grundpreis'];
  for (const line of lines) {
    if (!keys.some((k) => line.toLowerCase().includes(k))) continue;
    const v = allMatches(new RegExp(`${NOT_NUM}(\\d[.,]\\d{3})(?!\\d)`, 'g'), line)
      .map((m) => parseDecimal(m[1])).find((x) => x >= 0.3 && x <= 5);
    if (v != null) return v;
  }
  return null;
}

function lastAmount(line) {
  const values = allMatches(new RegExp(`${NOT_NUM}(\\d{1,4}(?:\\.\\d{3})*[.,]\\d{2})(?!\\d)`, 'g'), line)
    .map((m) => parseDecimal(m[1])).filter((v) => v != null);
  return values.length ? values.at(-1) : null;
}

function totalFrom(lines) {
  const keys = ['zu zahlen', 'endbetrag', 'gesamtbetrag', 'summe', 'gesamt', 'total', 'betrag'];
  const excluded = ['netto', 'mwst', 'ust', 'steuer', 'rückgeld', 'gegeben', 'zwischensumme'];
  for (const key of keys) {
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (!lower.includes(key) || excluded.some((x) => lower.includes(x))) continue;
      const here = lastAmount(lines[i]);
      if (here != null) return here;
      if (i + 1 < lines.length) {
        const next = lastAmount(lines[i + 1]);
        if (next != null) return next;
      }
    }
  }
  return null;
}

/** Datum als "JJJJ-MM-TT" */
function dateFrom(text) {
  for (const m of allMatches(/(?:^|\D)(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?!\d)/g, text)) {
    const day = +m[1];
    const month = +m[2];
    let year = +m[3];
    if (year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) continue;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

function stationFrom(lines) {
  for (const line of lines.slice(0, 6)) {
    if (/\d/.test(line)) continue;
    for (const brand of BRANDS) {
      const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:^|[^\\p{L}])${escaped}(?![\\p{L}])`, 'iu').test(line)) return brand;
    }
  }
  return null;
}

/** @returns {{liters, totalPrice, pricePerLiter, date, station}} – fehlende Werte sind null */
export function parseReceipt(lines) {
  const text = lines.join('\n');
  const data = {
    liters: litersFrom(lines, text),
    pricePerLiter: pricePerLiterFrom(lines, text),
    totalPrice: totalFrom(lines),
    date: dateFrom(text),
    station: stationFrom(lines),
  };
  const { liters: l, pricePerLiter: p, totalPrice: t } = data;
  if (l != null && p != null && t == null) data.totalPrice = round(l * p, 2);
  else if (l == null && p > 0 && t != null) data.liters = round(t / p, 2);
  else if (l > 0 && p == null && t != null) data.pricePerLiter = round(t / l, 3);
  return data;
}

export const isEmptyReceipt = (d) => Object.values(d).every((v) => v == null);

// ---------------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------------

/** Ø Verbrauch l/100 km nach Volltank-Methode. readings: [{ km, liters, full }] */
export function averageConsumption(readings) {
  const sorted = readings.filter((r) => r.km != null && r.liters != null).sort((a, b) => a.km - b.km);
  const first = sorted.findIndex((r) => r.full);
  if (first < 0) return null;
  let lastFullKm = sorted[first].km;
  let pending = 0;
  let liters = 0;
  let km = 0;
  for (const r of sorted.slice(first + 1)) {
    pending += r.liters;
    if (!r.full) continue;
    const d = r.km - lastFullKm;
    if (d > 0) {
      liters += pending;
      km += d;
    }
    pending = 0;
    lastFullKm = r.km;
  }
  return km > 0 ? (liters / km) * 100 : null;
}

export function rideDistance(ride) {
  if (ride.startKm == null || ride.endKm == null || ride.endKm < ride.startKm) return null;
  return ride.endKm - ride.startKm;
}

export function latestKm(rides, fuel) {
  const values = [...rides.flatMap((r) => [r.startKm, r.endKm]), ...fuel.map((f) => f.km)]
    .filter((v) => v != null);
  return values.length ? Math.max(...values) : null;
}

// ---------------------------------------------------------------------------
// CSV (Semikolon – öffnet sich direkt in Excel/Numbers/LibreOffice)
// ---------------------------------------------------------------------------
export function toCSV(rows) {
  return rows.map((row) => row.map((value) => {
    const s = value == null ? '' : String(value);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\n');
}
