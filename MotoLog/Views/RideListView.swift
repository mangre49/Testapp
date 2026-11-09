import SwiftData
import SwiftUI

struct RideListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Ride.date, order: .reverse) private var rides: [Ride]
    @Query private var fuelStops: [FuelStop]
    @State private var showNewRide = false

    var body: some View {
        NavigationStack {
            Group {
                if rides.isEmpty {
                    ContentUnavailableView {
                        Label("Noch keine Fahrten", systemImage: "road.lanes")
                    } description: {
                        Text("Fotografiere vor der Abfahrt deinen Tacho – der Kilometerstand wird automatisch erkannt.")
                    } actions: {
                        Button("Erste Fahrt anlegen") { showNewRide = true }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        ForEach(rides) { ride in
                            NavigationLink {
                                RideDetailView(ride: ride)
                            } label: {
                                RideRow(ride: ride)
                            }
                        }
                        .onDelete { offsets in
                            offsets.map { rides[$0] }.forEach(context.delete)
                        }
                    }
                }
            }
            .navigationTitle("Fahrten")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showNewRide = true } label: {
                        Label("Neue Fahrt", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewRide) {
                RideEditView(ride: nil, lastKnownKm: OdometerHistory.latestKm(rides: rides, fuelStops: fuelStops))
            }
        }
    }
}

struct RideRow: View {
    let ride: Ride

    var body: some View {
        HStack(spacing: 12) {
            PhotoThumbnail(data: ride.endPhoto ?? ride.startPhoto, systemImage: "gauge.with.dots.needle.67percent")
            VStack(alignment: .leading, spacing: 2) {
                Text(ride.displayTitle).font(.headline)
                Text(ride.date.formatted(date: .abbreviated, time: .shortened))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let distance = ride.distance {
                Text(Fmt.km(distance))
                    .font(.subheadline.monospacedDigit().bold())
            } else {
                Text("läuft")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.accentColor.opacity(0.2), in: Capsule())
            }
        }
    }
}

struct RideDetailView: View {
    let ride: Ride
    @Query private var allRides: [Ride]
    @Query private var allFuelStops: [FuelStop]
    @State private var showEdit = false
    @State private var showAddFuel = false
    @State private var editingFuel: FuelStop?

    private var stops: [FuelStop] {
        (ride.fuelStops ?? []).sorted { $0.date < $1.date }
    }

    var body: some View {
        List {
            Section {
                LabeledContent("Datum", value: ride.date.formatted(date: .long, time: .shortened))
                if let startKm = ride.startKm { LabeledContent("Start", value: Fmt.km(startKm)) }
                if let endKm = ride.endKm { LabeledContent("Ziel", value: Fmt.km(endKm)) }
                if let distance = ride.distance {
                    LabeledContent("Strecke") {
                        Text(Fmt.km(distance)).bold()
                    }
                }
            }

            if ride.startPhoto != nil || ride.endPhoto != nil {
                Section("Tachofotos") {
                    if let data = ride.startPhoto { PhotoPreview(data: data, caption: "Start") }
                    if let data = ride.endPhoto { PhotoPreview(data: data, caption: "Ziel") }
                }
            }

            Section("Tankstopps") {
                ForEach(stops) { stop in
                    Button { editingFuel = stop } label: { FuelRow(stop: stop) }
                        .tint(.primary)
                }
                Button { showAddFuel = true } label: {
                    Label("Tankstopp hinzufügen", systemImage: "fuelpump")
                }
            }

            if !ride.notes.isEmpty {
                Section("Notizen") { Text(ride.notes) }
            }
        }
        .navigationTitle(ride.displayTitle)
        .toolbar {
            Button("Bearbeiten") { showEdit = true }
        }
        .sheet(isPresented: $showEdit) {
            RideEditView(ride: ride, lastKnownKm: nil)
        }
        .sheet(isPresented: $showAddFuel) {
            FuelEditView(stop: nil, presetRide: ride,
                         lastKnownKm: OdometerHistory.latestKm(rides: allRides, fuelStops: allFuelStops))
        }
        .sheet(item: $editingFuel) { stop in
            FuelEditView(stop: stop, presetRide: nil, lastKnownKm: nil)
        }
    }
}
