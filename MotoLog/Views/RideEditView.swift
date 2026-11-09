import SwiftData
import SwiftUI

struct RideEditView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    /// nil = neue Fahrt anlegen
    let ride: Ride?
    /// Letzter bekannter Kilometerstand – hilft der Erkennung und füllt den Start vor.
    let lastKnownKm: Int?

    @State private var title = ""
    @State private var date = Date()
    @State private var notes = ""
    @State private var startKmText = ""
    @State private var endKmText = ""
    @State private var startPhoto: Data?
    @State private var endPhoto: Data?
    @State private var recognizingStart = false
    @State private var recognizingEnd = false
    @State private var message: String?
    @State private var didLoad = false

    private var startKm: Int? { NumberParsing.integer(from: startKmText) }
    private var endKm: Int? { NumberParsing.integer(from: endKmText) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Fahrt") {
                    TextField("Titel, z. B. Schwarzwald-Runde", text: $title)
                    DatePicker("Datum", selection: $date)
                }

                Section {
                    PhotoCaptureView(imageData: $startPhoto, isProcessing: recognizingStart) { image in
                        recognize(image, isStart: true)
                    }
                    KilometerField(title: "Kilometerstand", text: $startKmText)
                } header: {
                    Text("Start – Tacho")
                } footer: {
                    Text("Foto vom Tacho aufnehmen – der Kilometerstand wird automatisch ausgelesen. Bitte kurz prüfen.")
                }

                Section("Ziel – Tacho") {
                    PhotoCaptureView(imageData: $endPhoto, isProcessing: recognizingEnd) { image in
                        recognize(image, isStart: false)
                    }
                    KilometerField(title: "Kilometerstand", text: $endKmText)
                }

                if let startKm, let endKm {
                    Section {
                        if endKm >= startKm {
                            LabeledContent("Gefahrene Strecke") {
                                Text(Fmt.km(endKm - startKm)).bold()
                            }
                        } else {
                            Label("Ziel-Kilometerstand ist kleiner als der Start.", systemImage: "exclamationmark.triangle")
                                .foregroundStyle(.orange)
                        }
                    }
                }

                Section("Notizen") {
                    TextField("Route, Wetter, Erlebnisse …", text: $notes, axis: .vertical)
                        .lineLimit(3...8)
                }
            }
            .navigationTitle(ride == nil ? "Neue Fahrt" : "Fahrt bearbeiten")
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
        if let ride {
            title = ride.title
            date = ride.date
            notes = ride.notes
            startKmText = ride.startKm.map(String.init) ?? ""
            endKmText = ride.endKm.map(String.init) ?? ""
            startPhoto = ride.startPhoto
            endPhoto = ride.endPhoto
        } else if let lastKnownKm {
            startKmText = String(lastKnownKm)
        }
    }

    private func recognize(_ image: UIImage, isStart: Bool) {
        Task {
            if isStart { recognizingStart = true } else { recognizingEnd = true }
            defer { if isStart { recognizingStart = false } else { recognizingEnd = false } }
            do {
                let texts = try await TextRecognizer.recognize(in: image)
                let minimum = isStart ? lastKnownKm : (startKm ?? lastKnownKm)
                if let km = OdometerParser.bestReading(from: texts, atLeast: minimum) {
                    if isStart { startKmText = String(km) } else { endKmText = String(km) }
                } else {
                    message = "Auf dem Foto wurde kein Kilometerstand gefunden. Bitte manuell eintragen."
                }
            } catch {
                message = "Texterkennung fehlgeschlagen: \(error.localizedDescription)"
            }
        }
    }

    private func save() {
        let target = ride ?? Ride()
        target.title = title.trimmingCharacters(in: .whitespaces)
        target.date = date
        target.notes = notes
        target.startKm = startKm
        target.endKm = endKm
        target.startPhoto = startPhoto
        target.endPhoto = endPhoto
        if ride == nil { context.insert(target) }
        dismiss()
    }
}
