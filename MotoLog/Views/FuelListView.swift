import SwiftData
import SwiftUI

struct FuelListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \FuelStop.date, order: .reverse) private var stops: [FuelStop]
    @Query private var rides: [Ride]
    @State private var showNew = false
    @State private var editing: FuelStop?

    var body: some View {
        NavigationStack {
            Group {
                if stops.isEmpty {
                    ContentUnavailableView {
                        Label("Noch nicht getankt", systemImage: "fuelpump")
                    } description: {
                        Text("Fotografiere die Tankquittung – Liter, Betrag und Literpreis werden automatisch übernommen.")
                    } actions: {
                        Button("Tankstopp erfassen") { showNew = true }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        ForEach(stops) { stop in
                            Button { editing = stop } label: { FuelRow(stop: stop) }
                                .tint(.primary)
                        }
                        .onDelete { offsets in
                            offsets.map { stops[$0] }.forEach(context.delete)
                        }
                    }
                }
            }
            .navigationTitle("Tanken")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showNew = true } label: {
                        Label("Tankstopp", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNew) {
                FuelEditView(stop: nil, presetRide: nil,
                             lastKnownKm: OdometerHistory.latestKm(rides: rides, fuelStops: stops))
            }
            .sheet(item: $editing) { stop in
                FuelEditView(stop: stop, presetRide: nil, lastKnownKm: nil)
            }
        }
    }
}

struct FuelRow: View {
    let stop: FuelStop

    var body: some View {
        HStack(spacing: 12) {
            PhotoThumbnail(data: stop.receiptPhoto, systemImage: "doc.text")
            VStack(alignment: .leading, spacing: 2) {
                Text(stop.displayStation).font(.headline)
                Text(stop.date.formatted(date: .abbreviated, time: .omitted)
                     + (stop.odometerKm.map { " · " + Fmt.km($0) } ?? ""))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                if let total = stop.totalPrice {
                    Text(Fmt.money(total)).font(.subheadline.bold().monospacedDigit())
                }
                if let liters = stop.liters {
                    Text(Fmt.liters(liters)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct FuelEditView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Ride.date, order: .reverse) private var rides: [Ride]

    /// nil = neuen Tankstopp anlegen
    let stop: FuelStop?
    let presetRide: Ride?
    let lastKnownKm: Int?

    @State private var date = Date()
    @State private var station = ""
    @State private var litersText = ""
    @State private var totalText = ""
    @State private var kmText = ""
    @State private var isFullTank = true
    @State private var notes = ""
    @State private var receiptPhoto: Data?
    @State private var odometerPhoto: Data?
    @State private var ride: Ride?
    @State private var recognizingReceipt = false
    @State private var recognizingOdometer = false
    @State private var message: String?
    @State private var didLoad = false

    private var liters: Double? { NumberParsing.decimal(from: litersText) }
    private var total: Double? { NumberParsing.decimal(from: totalText) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    PhotoCaptureView(imageData: $receiptPhoto, isProcessing: recognizingReceipt) { image in
                        recognizeReceipt(image)
                    }
                } header: {
                    Text("Tankquittung")
                } footer: {
                    Text("Liter, Betrag, Datum und Tankstelle werden vom Beleg gelesen. Bitte kurz prüfen.")
                }

                Section("Tankvorgang") {
                    DatePicker("Datum", selection: $date)
                    TextField("Tankstelle", text: $station)
                    DecimalField(title: "Menge", text: $litersText, unit: "l")
                    DecimalField(title: "Betrag", text: $totalText, unit: Fmt.currencyCode)
                    if let liters, let total, liters > 0 {
                        LabeledContent("Preis pro Liter", value: Fmt.pricePerLiter(total / liters))
                    }
                    Toggle("Vollgetankt", isOn: $isFullTank)
                }

                Section {
                    PhotoCaptureView(imageData: $odometerPhoto, isProcessing: recognizingOdometer) { image in
                        recognizeOdometer(image)
                    }
                    KilometerField(title: "Kilometerstand", text: $kmText)
                } header: {
                    Text("Tacho")
                } footer: {
                    Text("Mit Kilometerstand und „Vollgetankt“ wird dein Verbrauch berechnet.")
                }

                Section("Zuordnung") {
                    Picker("Fahrt", selection: $ride) {
                        Text("Keine").tag(nil as Ride?)
                        ForEach(rides) { ride in
                            Text("\(ride.displayTitle) (\(ride.date.formatted(date: .numeric, time: .omitted)))")
                                .tag(ride as Ride?)
                        }
                    }
                    TextField("Notiz", text: $notes, axis: .vertical)
                }
            }
            .navigationTitle(stop == nil ? "Tankstopp" : "Tankstopp bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern", action: save)
                }
            }
            .messageAlert("Texterkennung", message: $message)
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard !didLoad else { return }
        didLoad = true
        if let stop {
            date = stop.date
            station = stop.station
            litersText = stop.liters.map { Fmt.input($0, digits: 2) } ?? ""
            totalText = stop.totalPrice.map { Fmt.input($0, digits: 2) } ?? ""
            kmText = stop.odometerKm.map(String.init) ?? ""
            isFullTank = stop.isFullTank
            notes = stop.notes
            receiptPhoto = stop.receiptPhoto
            odometerPhoto = stop.odometerPhoto
            ride = stop.ride
        } else {
            ride = presetRide
        }
    }

    private func recognizeReceipt(_ image: UIImage) {
        Task {
            recognizingReceipt = true
            defer { recognizingReceipt = false }
            do {
                let texts = try await TextRecognizer.recognize(in: image)
                let data = ReceiptParser.parse(lines: TextLayout.lines(from: texts))
                guard !data.isEmpty else {
                    message = "Auf dem Beleg wurden keine Werte erkannt. Bitte manuell eintragen."
                    return
                }
                if let value = data.liters { litersText = Fmt.input(value, digits: 2) }
                if let value = data.totalPrice { totalText = Fmt.input(value, digits: 2) }
                if let value = data.date { date = value }
                if let value = data.station, station.isEmpty { station = value }
                if data.liters == nil || data.totalPrice == nil {
                    message = "Nicht alle Werte erkannt – bitte Menge und Betrag prüfen."
                }
            } catch {
                message = "Texterkennung fehlgeschlagen: \(error.localizedDescription)"
            }
        }
    }

    private func recognizeOdometer(_ image: UIImage) {
        Task {
            recognizingOdometer = true
            defer { recognizingOdometer = false }
            do {
                let texts = try await TextRecognizer.recognize(in: image)
                if let km = OdometerParser.bestReading(from: texts, atLeast: lastKnownKm ?? stop?.odometerKm) {
                    kmText = String(km)
                } else {
                    message = "Auf dem Foto wurde kein Kilometerstand gefunden. Bitte manuell eintragen."
                }
            } catch {
                message = "Texterkennung fehlgeschlagen: \(error.localizedDescription)"
            }
        }
    }

    private func save() {
        let target = stop ?? FuelStop()
        target.date = date
        target.station = station.trimmingCharacters(in: .whitespaces)
        target.liters = liters
        target.totalPrice = total
        target.odometerKm = NumberParsing.integer(from: kmText)
        target.isFullTank = isFullTank
        target.notes = notes
        target.receiptPhoto = receiptPhoto
        target.odometerPhoto = odometerPhoto
        target.ride = ride
        if stop == nil { context.insert(target) }
        dismiss()
    }
}
