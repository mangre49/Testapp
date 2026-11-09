# MotoLog 🏍️ – Fahrtenbuch für Motorradfahrer

MotoLog dokumentiert deine Motorradfahrten und Tankstopps – mit Fotos und
automatischer Texterkennung. Es gibt zwei Varianten:

| Variante | Läuft auf | Ordner |
|---|---|---|
| **Web-App (PWA)** – empfohlen | iPhone **und** Android, im Browser, installierbar auf dem Home-Bildschirm | `docs/` |
| Native iOS-App | nur iPhone, braucht einen Mac mit Xcode | `MotoLog/` |

## Web-App (iPhone & Android)

**Funktionen**

- **Fahrten:** Tachofoto bei Abfahrt und Ankunft → Kilometerstand wird erkannt, Strecke berechnet. Titel, Datum, Notizen.
- **Tanken ⛽️:** Foto der Tankquittung → Liter, Betrag, Literpreis, Datum und Tankstelle werden ausgelesen. Optional Tachofoto, Zuordnung zu einer Fahrt.
- **Statistik:** Gesamtstrecke, längste Fahrt, Tachostand, Tankkosten, Ø Literpreis, **Ø Verbrauch** (Volltank-Methode), Spritkosten / 100 km.
- **Daten:** CSV-Export (Excel, Numbers, LibreOffice), Sicherung inkl. Fotos als Datei und Wiederherstellung.
- Funktioniert offline, Daten bleiben **nur auf dem Handy** (kein Konto, kein Server).
- Texterkennung mit [Tesseract.js](https://github.com/naptha/tesseract.js) direkt auf dem Handy. Beim ersten Foto
  werden einmalig ca. 10 MB Sprachdaten geladen.

**Veröffentlichen mit GitHub Pages (kostenlos)**

1. Auf GitHub im Projekt: **Settings → Pages**.
2. Bei *Build and deployment* → *Source*: **Deploy from a branch**.
3. Branch auswählen (z. B. `main`) und Ordner **`/docs`** → **Save**.
4. Nach 1–2 Minuten ist die App erreichbar unter
   `https://<dein-github-name>.github.io/<projektname>/`.

> GitHub Pages ist für **öffentliche** Projekte kostenlos. Deine Fahrtdaten sind trotzdem privat –
> sie liegen nur auf deinem Handy, öffentlich ist nur der Programmcode.

**Auf dem Handy installieren**

- **iPhone:** Link in **Safari** öffnen → Teilen ⬆︎ → **„Zum Home-Bildschirm“**.
- **Android:** Link in **Chrome** öffnen → Menü ⋮ → **„App installieren“** (oder Hinweis in der App antippen).

**Wichtig:** Da die Daten nur im Browser-Speicher des Handys liegen, ab und zu unter
**⋯ → Sicherung erstellen** ein Backup machen (z. B. in iCloud Drive / Google Drive speichern).

**Lokal ausprobieren & testen (Linux)**

```bash
python3 -m http.server 8080 --directory docs   # dann http://localhost:8080 öffnen
node --test tests/web/*.test.mjs               # Tests der Erkennungslogik
```

Struktur der Web-App:

```
docs/
├── index.html, styles.css      Oberfläche (für Handys optimiert, Hell/Dunkel)
├── manifest.webmanifest, sw.js Installierbar & offline-fähig
└── js/
    ├── app.js      Ansichten: Fahrten, Tanken, Statistik, Sicherung
    ├── parsers.js  Kilometerstand & Quittung auslesen, Verbrauch, CSV
    ├── ocr.js      Texterkennung (Tesseract.js)
    ├── db.js       Speicher im Browser (IndexedDB)
    └── images.js, ui.js, format.js
```

---

# Native iOS-App (optional, braucht einen Mac)

Die gleiche App als native Swift/SwiftUI-App mit Apples Texterkennung (Vision).

## Funktionen (iOS)

| Bereich | Was die App macht |
|---|---|
| **Fahrten** | Titel, Datum, Notizen. Foto vom Tacho bei Start und Ziel → der **Kilometerstand wird automatisch erkannt**. Die gefahrene Strecke wird berechnet. |
| **Tanken ⛽️** | Foto der **Tankquittung** → Liter, Betrag, Literpreis, Datum und Tankstelle (Aral, Shell, Esso, JET, …) werden ausgelesen. Optional Tachofoto für den km-Stand. Tankstopps lassen sich einer Fahrt zuordnen. |
| **Statistik** | Gesamtstrecke, längste Fahrt, aktueller Tachostand, getankte Liter, Tankkosten, Ø Literpreis, **Ø Verbrauch (l/100 km)** und Spritkosten pro 100 km. |
| **Export** | Fahrten und Tankstopps als CSV (z. B. für Excel/Numbers) teilen. |

Alle erkannten Werte bleiben editierbar – bitte nach dem Foto kurz prüfen.
Fotos lassen sich antippen und zoomen.

## iOS-App auf das iPhone bringen

Du brauchst einen **Mac** mit **Xcode 16 oder neuer** (kostenlos im Mac App Store)
und ein iPhone mit **iOS 17 oder neuer**. Ein kostenpflichtiger Apple-Developer-Account
ist **nicht** nötig – deine normale Apple-ID reicht.

1. Projekt herunterladen: auf GitHub **Code → Download ZIP**, entpacken.
2. `MotoLog.xcodeproj` doppelklicken – Xcode öffnet sich.
3. Links das blaue Projekt **MotoLog** → Target **MotoLog** → Reiter
   **Signing & Capabilities**:
   - **Team**: deine Apple-ID auswählen (ggf. „Add Account…“).
   - **Bundle Identifier**: in etwas Eigenes ändern, z. B. `de.deinname.motolog`.
4. iPhone per Kabel verbinden und oben in Xcode als Ziel auswählen.
5. ▶︎ **Run** drücken (⌘R).
6. Beim ersten Mal auf dem iPhone: **Einstellungen → Allgemein → VPN & Geräteverwaltung**
   → deinem Entwicklerzertifikat vertrauen. Ggf. außerdem den
   **Entwicklermodus** aktivieren (Einstellungen → Datenschutz & Sicherheit).

> Hinweis: Mit einer kostenlosen Apple-ID läuft die App 7 Tage, danach einfach
> erneut aus Xcode starten. Für TestFlight / App Store brauchst du das
> Apple Developer Program (99 €/Jahr).

Tests laufen in Xcode mit **⌘U** (Simulator).

## Projektstruktur

```
MotoLog/
├── MotoLogApp.swift          App-Start, SwiftData-Datenbank
├── Models/                   Ride (Fahrt), FuelStop (Tankstopp)
├── Services/
│   ├── TextRecognizer.swift  Apple Vision – Texterkennung auf dem Gerät
│   ├── OdometerParser.swift  Kilometerstand aus Tachofoto ermitteln
│   ├── ReceiptParser.swift   Liter/Betrag/Preis/Datum aus Tankquittung
│   ├── FuelStatistics.swift  Verbrauch nach Volltank-Methode
│   └── CSVExport.swift       CSV-Export
└── Views/                    SwiftUI-Oberflächen (Fahrten, Tanken, Statistik)
MotoLogTests/                 Unit-Tests für die Erkennung und Statistik
```

Technik: Swift 5, SwiftUI, SwiftData, Vision, PhotosUI – keine externen Abhängigkeiten.
Alle Daten bleiben lokal auf dem iPhone.

## Ideen für später

- Mehrere Motorräder verwalten
- GPS-Strecke der Fahrt aufzeichnen und auf der Karte anzeigen
- Wartung & Service (Ölwechsel, Reifen, TÜV) mit Erinnerungen
- iCloud-Sync zwischen iPhone und iPad
- App-Icon gestalten (`Assets.xcassets/AppIcon`)
