# MotoLog 🏍️ – Fahrtenbuch für Motorradfahrer (iOS)

MotoLog dokumentiert deine Motorradfahrten und Tankstopps – mit Fotos und
automatischer Texterkennung direkt auf dem iPhone (ohne Internet, ohne Konto).

## Funktionen

| Bereich | Was die App macht |
|---|---|
| **Fahrten** | Titel, Datum, Notizen. Foto vom Tacho bei Start und Ziel → der **Kilometerstand wird automatisch erkannt**. Die gefahrene Strecke wird berechnet. |
| **Tanken ⛽️** | Foto der **Tankquittung** → Liter, Betrag, Literpreis, Datum und Tankstelle (Aral, Shell, Esso, JET, …) werden ausgelesen. Optional Tachofoto für den km-Stand. Tankstopps lassen sich einer Fahrt zuordnen. |
| **Statistik** | Gesamtstrecke, längste Fahrt, aktueller Tachostand, getankte Liter, Tankkosten, Ø Literpreis, **Ø Verbrauch (l/100 km)** und Spritkosten pro 100 km. |
| **Export** | Fahrten und Tankstopps als CSV (z. B. für Excel/Numbers) teilen. |

Alle erkannten Werte bleiben editierbar – bitte nach dem Foto kurz prüfen.
Fotos lassen sich antippen und zoomen.

## So startest du die App auf deinem iPhone

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
