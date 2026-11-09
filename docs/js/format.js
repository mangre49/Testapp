const nf = (opts) => new Intl.NumberFormat('de-DE', opts);
const intFmt = nf({ maximumFractionDigits: 0 });
const litFmt = nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyFmt = nf({ style: 'currency', currency: 'EUR' });
const pplFmt = nf({ style: 'currency', currency: 'EUR', minimumFractionDigits: 3, maximumFractionDigits: 3 });
const oneFmt = nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtKm = (v) => `${intFmt.format(v)} km`;
export const fmtLiters = (v) => `${litFmt.format(v)} l`;
export const fmtMoney = (v) => moneyFmt.format(v);
export const fmtPpl = (v) => `${pplFmt.format(v)}/l`;
export const fmtConsumption = (v) => `${oneFmt.format(v)} l/100 km`;
/** Wert für Eingabefelder, z. B. "15,42" */
export const fmtInput = (v, digits = 2) => (v == null ? '' : v.toFixed(digits).replace('.', ','));

export const fmtDate = (iso) => new Date(iso).toLocaleDateString('de-DE', {
  weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
});
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
export const fmtMonth = (iso) => new Date(iso).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

/** ISO → Wert für <input type="datetime-local"> (lokale Zeit) */
export function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : new Date().toISOString());

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
