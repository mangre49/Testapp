import Foundation

/// Ein von der Texterkennung gefundenes Textstück.
/// Koordinaten sind normiert (0...1), Ursprung unten links (wie bei Vision).
struct RecognizedText: Equatable {
    var text: String
    var x: Double = 0
    var y: Double = 0
    var height: Double = 0
}

enum TextLayout {
    /// Fasst Textstücke, die auf gleicher Höhe liegen, zu Zeilen zusammen
    /// (wichtig für Quittungen: "Summe" links, "28,67" rechts).
    static func lines(from items: [RecognizedText]) -> [String] {
        let sorted = items.sorted { $0.y > $1.y }
        var groups: [[RecognizedText]] = []
        for item in sorted {
            if let anchor = groups.last?.first,
               abs(anchor.y - item.y) < max(anchor.height, item.height) * 0.5 {
                groups[groups.count - 1].append(item)
            } else {
                groups.append([item])
            }
        }
        return groups.map { group in
            group.sorted { $0.x < $1.x }.map(\.text).joined(separator: "  ")
        }
    }
}
