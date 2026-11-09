import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            RideListView()
                .tabItem { Label("Fahrten", systemImage: "road.lanes") }
            FuelListView()
                .tabItem { Label("Tanken", systemImage: "fuelpump") }
            StatsView()
                .tabItem { Label("Statistik", systemImage: "chart.bar") }
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: [Ride.self, FuelStop.self], inMemory: true)
}
