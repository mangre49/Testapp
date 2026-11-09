import Foundation
import SwiftData

/// Eine dokumentierte Motorradfahrt mit Tachostand bei Start und Ziel.
@Model
final class Ride {
    var date: Date = Date()
    var title: String = ""
    var startKm: Int?
    var endKm: Int?
    var notes: String = ""

    /// Foto vom Tacho bei Fahrtbeginn (JPEG).
    @Attribute(.externalStorage) var startPhoto: Data?
    /// Foto vom Tacho bei Fahrtende (JPEG).
    @Attribute(.externalStorage) var endPhoto: Data?

    /// Tankstopps, die dieser Fahrt zugeordnet sind.
    @Relationship(deleteRule: .nullify, inverse: \FuelStop.ride)
    var fuelStops: [FuelStop]? = []

    init(date: Date = .now, title: String = "", startKm: Int? = nil, endKm: Int? = nil, notes: String = "") {
        self.date = date
        self.title = title
        self.startKm = startKm
        self.endKm = endKm
        self.notes = notes
    }

    /// Gefahrene Kilometer (nur wenn Start- und Zielstand plausibel sind).
    var distance: Int? {
        guard let startKm, let endKm, endKm >= startKm else { return nil }
        return endKm - startKm
    }

    var displayTitle: String {
        title.trimmingCharacters(in: .whitespaces).isEmpty ? "Ausfahrt" : title
    }
}
