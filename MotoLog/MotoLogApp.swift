import SwiftUI
import SwiftData

@main
struct MotoLogApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [Ride.self, FuelStop.self])
    }
}
