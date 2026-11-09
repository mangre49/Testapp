import Foundation

enum Fmt {
    static var currencyCode: String { Locale.current.currency?.identifier ?? "EUR" }

    static func km(_ value: Int) -> String { "\(value.formatted()) km" }

    static func liters(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(2))) + " l"
    }

    static func money(_ value: Double) -> String {
        value.formatted(.currency(code: currencyCode))
    }

    static func pricePerLiter(_ value: Double) -> String {
        value.formatted(.currency(code: currencyCode).precision(.fractionLength(3))) + "/l"
    }

    static func consumption(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(1))) + " l/100 km"
    }

    /// Wert für ein Eingabefeld (ohne Tausendertrenner).
    static func input(_ value: Double, digits: Int) -> String {
        value.formatted(.number.precision(.fractionLength(digits)).grouping(.never))
    }
}

enum OdometerHistory {
    /// Höchster bisher erfasster Kilometerstand.
    static func latestKm(rides: [Ride], fuelStops: [FuelStop]) -> Int? {
        (rides.flatMap { [$0.startKm, $0.endKm] } + fuelStops.map(\.odometerKm)).compactMap { $0 }.max()
    }
}
