import Foundation

struct FuelReading: Equatable {
    var odometerKm: Int
    var liters: Double
    var isFullTank: Bool
}

enum FuelStatistics {
    /// Durchschnittsverbrauch in l/100 km nach der Volltank-Methode:
    /// Liter seit dem letzten Volltanken ÷ gefahrene km seitdem.
    static func averageConsumption(_ readings: [FuelReading]) -> Double? {
        let sorted = readings.sorted { $0.odometerKm < $1.odometerKm }
        guard let firstFull = sorted.firstIndex(where: \.isFullTank) else { return nil }

        var lastFullKm = sorted[firstFull].odometerKm
        var pendingLiters = 0.0
        var totalLiters = 0.0
        var totalKm = 0

        for reading in sorted[(firstFull + 1)...] {
            pendingLiters += reading.liters
            guard reading.isFullTank else { continue }
            let km = reading.odometerKm - lastFullKm
            if km > 0 {
                totalLiters += pendingLiters
                totalKm += km
            }
            pendingLiters = 0
            lastFullKm = reading.odometerKm
        }
        guard totalKm > 0 else { return nil }
        return totalLiters / Double(totalKm) * 100
    }
}
