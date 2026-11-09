// Texterkennung mit Tesseract.js (läuft im Browser auf dem Handy).
// Beim ersten Mal werden ca. 10 MB Sprachdaten geladen, danach offline nutzbar.
import { prepareForOcr } from './images.js';
import { bestOdometer, groupLines, parseReceipt } from './parsers.js';

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let workerPromise;
let progressListener = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Texterkennung konnte nicht geladen werden – bitte Internetverbindung prüfen.'));
    document.head.append(script);
  });
}

function getWorker() {
  workerPromise ??= (async () => {
    await loadScript(TESSERACT_URL);
    return window.Tesseract.createWorker(['deu', 'eng'], 1, {
      logger: (m) => progressListener?.(m),
    });
  })().catch((error) => {
    workerPromise = null;
    throw error;
  });
  return workerPromise;
}

function describe(m) {
  const pct = Math.round((m.progress ?? 0) * 100);
  if (m.status === 'recognizing text') return `Text wird erkannt … ${pct} %`;
  if (/loading|initializ/.test(m.status)) return 'Texterkennung wird vorbereitet …';
  return 'Bitte warten …';
}

async function recognize(canvas, pageSegMode, onProgress) {
  const worker = await getWorker();
  progressListener = (m) => onProgress?.(describe(m));
  try {
    await worker.setParameters({ tessedit_pageseg_mode: pageSegMode });
    const { data } = await worker.recognize(canvas);
    const lines = (data.lines ?? []).map((line) => ({
      text: line.text.trim(),
      x: line.bbox.x0 / canvas.width,
      y: line.bbox.y0 / canvas.height,
      height: (line.bbox.y1 - line.bbox.y0) / canvas.height,
    })).filter((l) => l.text);
    if (!lines.length && data.text) {
      return data.text.split('\n').map((text) => ({ text: text.trim(), x: 0, y: 0, height: 0 })).filter((l) => l.text);
    }
    return lines;
  } finally {
    progressListener = null;
  }
}

/** Liefert den erkannten Kilometerstand oder null. */
export async function readOdometer(blob, minimum, onProgress) {
  // 11 = verstreuter Text (Ziffern im Display), danach invertiert für dunkle Displays
  for (const invert of [false, true]) {
    const canvas = await prepareForOcr(blob, { invert });
    const km = bestOdometer(await recognize(canvas, '11', onProgress), minimum);
    if (km != null) return km;
  }
  return null;
}

/** Liefert { liters, totalPrice, pricePerLiter, date, station }. */
export async function readReceipt(blob, onProgress) {
  const canvas = await prepareForOcr(blob, { maxSize: 2200 });
  const items = await recognize(canvas, '4', onProgress);
  return parseReceipt(groupLines(items));
}
