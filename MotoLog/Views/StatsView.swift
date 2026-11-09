import SwiftData
import SwiftUI

struct StatsView: View {
    @Query private var rides: [Ride]
    @Query private var stops: [FuelStop]

    private var totalDistance: Int { rides.compactMap(\.distance).reduce(0, +) }
    private var totalLiters: Double { stops.compactMap(\.liters).reduce(0, +) }
    private var totalCost: Double { stops.compactMap(\.totalPrice).reduce(0, +) }

    private var averageConsumption: Double? {
        FuelStatistics.averageConsumption(stops.compactMap { stop in
            guard let km = stop.odometerKm, let liters = stop.liters else { return nil }
            return FuelReading(odometerKm: km, liters: liters, isFullTank: stop.isFullTank)
        })
    }

    private var averagePricePerLiter: Double? {
        let paired = stops.filter { $0.liters != nil && $0.totalPrice != nil }
        let liters = paired.compactMap(\.liters).reduce(0, +)
        guard liters > 0 else { return nil }
        return paired.compactMap(\.totalPrice).reduce(0, +) / liters
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Fahrten") {
                    LabeledContent("Anzahl", value: "\(rides.count)")
                    LabeledContent("Gesamtstrecke", value: Fmt.km(totalDistance))
                    if let longest = rides.compactMap(\.distance).max() {
                        LabeledContent("Längste Fahrt", value: Fmt.km(longest))
                    }
                    if let km = OdometerHistory.latestKm(rides: rides, fuelStops: stops) {
                        LabeledContent("Aktueller Tachostand", value: Fmt.km(km))
                    }
                }

                Section {
                    LabeledContent("Tankstopps", value: "\(stops.count)")
                    LabeledContent("Getankt", value: Fmt.liters(totalLiters))
                    LabeledContent("Tankkosten", value: Fmt.money(totalCost))
                    if let price = averagePricePerLiter {
                        LabeledContent("Ø Literpreis", value: Fmt.pricePerLiter(price))
                    }
                    if let consumption = averageConsumption {
                        LabeledContent("Ø Verbrauch", value: Fmt.consumption(consumption))
                        if let price = averagePricePerLiter {
                            LabeledContent("Spritkosten / 100 km", value: Fmt.money(consumption * price))
                        }
                    }
                } header: {
                    Text("Tanken")
                } footer: {
                    if averageConsumption == nil {
                        Text("Für den Verbrauch mindestens zweimal vollgetankt mit Kilometerstand erfassen.")
                    }
                }

                Section("Export") {
                    ShareLink(item: CSVExporter.rides(rides), preview: SharePreview("Fahrten (CSV)")) {
                        Label("Fahrten exportieren", systemImage: "square.and.arrow.up")
                    }
                    ShareLink(item: CSVExporter.fuelStops(stops), preview: SharePreview("Tankstopps (CSV)")) {
                        Label("Tankstopps exportieren", systemImage: "square.and.arrow.up")
                    }
                }
            }
            .navigationTitle("Statistik")
        }
    }
}
