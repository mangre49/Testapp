import Foundation
import SwiftData

/// Ein Tankvorgang mit Beleg (Rechnung) und optionalem Tachofoto.
@Model
final class FuelStop {
    var date: Date = Date()
    var station: String = ""
    var liters: Double?
    var totalPrice: Double?
    var odometerKm: Int?
    var isFullTank: Bool = true
    var notes: String = ""

    /// Foto der Tankquittung (JPEG).
    @Attribute(.externalStorage) var receiptPhoto: Data?
    /// Foto vom Tacho beim Tanken (JPEG).
    @Attribute(.externalStorage) var odometerPhoto: Data?

    var ride: Ride?

    init(date: Date = .now, station: String = "", liters: Double? = nil, totalPrice: Double? = nil,
         odometerKm: Int? = nil, isFullTank: Bool = true) {
        self.date = date
        self.station = station
        self.liters = liters
        self.totalPrice = totalPrice
        self.odometerKm = odometerKm
        self.isFullTank = isFullTank
    }

    var pricePerLiter: Double? {
        guard let liters, let totalPrice, liters > 0 else { return nil }
        return totalPrice / liters
    }

    var displayStation: String {
        station.trimmingCharacters(in: .whitespaces).isEmpty ? "Tankstopp" : station
    }
}
