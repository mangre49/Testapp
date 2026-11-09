import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDecimal, parseInteger, groupLines, bestOdometer, parseReceipt, isEmptyReceipt,
  averageConsumption, rideDistance, latestKm, toCSV,
} from '../../docs/js/parsers.js';

test('Dezimalzahlen', () => {
  assert.equal(parseDecimal('45,23'), 45.23);
  assert.equal(parseDecimal('45.23'), 45.23);
  assert.equal(parseDecimal('1.234,56'), 1234.56);
  assert.equal(parseDecimal('1,234.56'), 1234.56);
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('abc'), null);
  assert.equal(parseInteger('12.345'), 12345);
  assert.equal(parseInteger('km'), null);
});

test('Tacho: großer Gesamtkilometerstand schlägt Skala', () => {
  assert.equal(bestOdometer([
    { text: '120', height: 0.03 }, { text: 'km/h', height: 0.02 }, { text: '012345', height: 0.08 },
  ]), 12345);
});

test('Tacho: Tausendertrenner', () => {
  assert.equal(bestOdometer([{ text: 'ODO 23.456 km', height: 0.05 }]), 23456);
  assert.equal(bestOdometer([{ text: '23 456 km', height: 0.05 }]), 23456);
});

test('Tacho: Tageskilometer mit Komma wird ignoriert', () => {
  assert.equal(bestOdometer([{ text: 'TRIP 123.4', height: 0.06 }, { text: '45678', height: 0.05 }]), 45678);
});

test('Tacho: OCR-Verwechsler', () => {
  assert.equal(bestOdometer([{ text: '4S67B', height: 0.05 }]), 45678);
});

test('Tacho: letzter Stand hilft bei der Auswahl', () => {
  assert.equal(bestOdometer([{ text: '98765', height: 0.05 }, { text: '23456', height: 0.05 }], 23000), 23456);
  assert.equal(bestOdometer([{ text: 'FUEL', height: 0.05 }]), null);
});

test('Quittung: deutscher Beleg', () => {
  const d = parseReceipt([
    'ARAL Tankstelle', 'Musterstr. 1', 'Datum: 14.06.2026 12:31', 'Super E10',
    '15,42 l x 1,859 EUR/l', '28,67 EUR', 'Summe EUR 28,67', 'Bar 30,00', 'Rückgeld 1,33', 'MwSt 19% 4,58',
  ]);
  assert.deepEqual(d, { liters: 15.42, pricePerLiter: 1.859, totalPrice: 28.67, date: '2026-06-14', station: 'Aral' });
});

test('Quittung: Schlüsselwörter und Punkt als Dezimaltrenner', () => {
  const d = parseReceipt(['Shell', 'Menge 12.50 L', 'Preis/L 1.799', 'Total 22.49']);
  assert.equal(d.liters, 12.5);
  assert.equal(d.pricePerLiter, 1.799);
  assert.equal(d.totalPrice, 22.49);
  assert.equal(d.station, 'Shell');
});

test('Quittung: fehlender Wert wird berechnet', () => {
  assert.equal(parseReceipt(['15,42 l x 1,859 €/l']).totalPrice, 28.67);
  assert.equal(parseReceipt(['Literpreis 1,800', 'Summe 27,00']).liters, 15);
  assert.equal(parseReceipt(['Zu zahlen', 'EUR 41,10']).totalPrice, 41.1);
  assert.ok(isEmptyReceipt(parseReceipt(['Vielen Dank', 'Gute Fahrt'])));
});

test('Zeilen gruppieren', () => {
  assert.deepEqual(groupLines([
    { text: '28,67', x: 0.8, y: 0.5, height: 0.02 },
    { text: 'Summe', x: 0.1, y: 0.495, height: 0.02 },
    { text: 'ARAL', x: 0.5, y: 0.1, height: 0.03 },
  ]), ['ARAL', 'Summe  28,67']);
});

test('Verbrauch nach Volltank-Methode', () => {
  const c = averageConsumption([
    { km: 10000, liters: 14, full: true },
    { km: 10150, liters: 5, full: false },
    { km: 10300, liters: 10, full: true },
  ]);
  assert.ok(Math.abs(c - 5) < 1e-9);
  assert.equal(averageConsumption([{ km: 1, liters: 10, full: true }]), null);
});

test('Strecke, letzter km-Stand, CSV', () => {
  assert.equal(rideDistance({ startKm: 100, endKm: 250 }), 150);
  assert.equal(rideDistance({ startKm: 300, endKm: 250 }), null);
  assert.equal(latestKm([{ startKm: 100, endKm: 250 }], [{ km: 400 }, { km: null }]), 400);
  assert.equal(latestKm([], []), null);
  assert.equal(toCSV([['a', 'b;c'], ['say "hi"', null]]), 'a;"b;c"\n"say ""hi""";');
});

test('Quittung: echte OCR-Ausgabe mit "1" statt "l"', () => {
  const d = parseReceipt([
    'ARAL Tankstelle', 'Hauptstr. 12, 79100 Freiburg', 'Datum: 14.06.2026 12:31', 'Super E10',
    '15,42 1 x 1,859 EUR/1', '28,67 EUR', 'Summe EUR 28,67', 'Kartenzahlung 28,67', 'MwSt 19% 4,58',
  ]);
  assert.deepEqual(d, { liters: 15.42, pricePerLiter: 1.859, totalPrice: 28.67, date: '2026-06-14', station: 'Aral' });
  assert.equal(parseReceipt(['Preis 1,799 EUR/1']).pricePerLiter, 1.799);
  assert.equal(parseReceipt(['12,50 x 1,799']).liters, 12.5);
});
