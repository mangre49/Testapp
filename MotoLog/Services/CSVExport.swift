import Foundation
import SwiftUI
import UniformTypeIdentifiers

/// CSV mit Semikolon als Trenner – öffnet sich direkt in Excel / Numbers.
struct CSVDocument: Transferable {
    let text: String
    let fileName: String

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .commaSeparatedText) { document in
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(document.fileName)
            try Data(document.text.utf8).write(to: url, options: .atomic)
            return SentTransferredFile(url)
        }
    }
}

enum CSVExporter {
    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "dd.MM.yyyy HH:mm"
        return formatter
    }()

    static func rides(_ rides: [Ride]) -> CSVDocument {
        var rows = [["Datum", "Titel", "Start km", "Ziel km", "Strecke km", "Notizen"]]
        for ride in rides.sorted(by: { $0.date < $1.date }) {
            rows.append([dateFormatter.string(from: ride.date), ride.displayTitle,
                         ride.startKm.map(String.init) ?? "", ride.endKm.map(String.init) ?? "",
                         ride.distance.map(String.init) ?? "", ride.notes])
        }
        return CSVDocument(text: csv(rows), fileName: "MotoLog-Fahrten.csv")
    }

    static func fuelStops(_ stops: [FuelStop]) -> CSVDocument {
        var rows = [["Datum", "Tankstelle", "Liter", "Betrag", "Preis/l", "km-Stand", "Volltank", "Fahrt"]]
        for stop in stops.sorted(by: { $0.date < $1.date }) {
            rows.append([dateFormatter.string(from: stop.date), stop.station,
                         stop.liters.map { Fmt.input($0, digits: 2) } ?? "",
                         stop.totalPrice.map { Fmt.input($0, digits: 2) } ?? "",
                         stop.pricePerLiter.map { Fmt.input($0, digits: 3) } ?? "",
                         stop.odometerKm.map(String.init) ?? "",
                         stop.isFullTank ? "ja" : "nein",
                         stop.ride?.displayTitle ?? ""])
        }
        return CSVDocument(text: csv(rows), fileName: "MotoLog-Tanken.csv")
    }

    private static func csv(_ rows: [[String]]) -> String {
        rows.map { row in
            row.map { field in
                let needsQuotes = field.contains(";") || field.contains("\"") || field.contains("\n")
                let escaped = field.replacingOccurrences(of: "\"", with: "\"\"")
                return needsQuotes ? "\"\(escaped)\"" : escaped
            }.joined(separator: ";")
        }.joined(separator: "\n")
    }
}
