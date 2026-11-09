import Foundation

struct ReceiptData: Equatable {
    var liters: Double?
    var totalPrice: Double?
    var pricePerLiter: Double?
    var date: Date?
    var station: String?

    var isEmpty: Bool {
        liters == nil && totalPrice == nil && pricePerLiter == nil && date == nil && station == nil
    }
}

/// Liest Liter, Betrag, Literpreis, Datum und Tankstelle aus dem Text einer Tankquittung.
enum ReceiptParser {
    static let brands = ["TotalEnergies", "Raiffeisen", "Westfalen", "Circle K", "Tamoil", "Texaco",
                         "Turmöl", "Migrol", "Socar", "Orlen", "Shell", "Agip", "Aral", "Esso", "Avia",
                         "Total", "JET", "OMV", "Eni", "HEM", "Star", "bft", "BP", "Q8"]

    private static let literUnit = #"(?:liter|litre|ltr|lt|l)\b"#
    private static let moneyPattern = #"(?<![\d.,])(\d{1,4}(?:\.\d{3})*[.,]\d{2})(?!\d)"#

    static func parse(lines: [String]) -> ReceiptData {
        let text = lines.joined(separator: "\n")
        var data = ReceiptData()
        data.liters = liters(in: lines, text: text)
        data.pricePerLiter = pricePerLiter(in: lines, text: text)
        data.totalPrice = total(in: lines)
        data.date = date(in: text)
        data.station = station(in: lines)

        // Fehlenden Wert aus den beiden anderen berechnen
        switch (data.liters, data.pricePerLiter, data.totalPrice) {
        case let (l?, p?, nil):
            data.totalPrice = NumberParsing.round(l * p, digits: 2)
        case let (nil, p?, t?) where p > 0:
            data.liters = NumberParsing.round(t / p, digits: 2)
        case let (l?, nil, t?) where l > 0:
            data.pricePerLiter = NumberParsing.round(t / l, digits: 3)
        default:
            break
        }
        return data
    }

    // MARK: - Einzelwerte

    static func liters(in lines: [String], text: String) -> Double? {
        let direct = NumberParsing.captures(of: #"(?<![\d.,])(\d{1,3}[.,]\d{1,3})[ \t]*"# + literUnit, in: text)
            .compactMap { NumberParsing.decimal(from: $0[1]) }
            .first { (0.3...150).contains($0) }
        if let direct { return direct }

        for line in lines where ["menge", "liter", "abgabe", "volumen"].contains(where: line.lowercased().contains) {
            if line.lowercased().contains("/l") || line.lowercased().contains("preis") { continue }
            let value = NumberParsing.captures(of: #"(?<![\d.,])(\d{1,3}[.,]\d{2,3})(?!\d)"#, in: line)
                .compactMap { NumberParsing.decimal(from: $0[1]) }
                .first { (0.3...150).contains($0) }
            if let value { return value }
        }
        return nil
    }

    static func pricePerLiter(in lines: [String], text: String) -> Double? {
        let direct = NumberParsing.captures(
            of: #"(?<![\d.,])(\d[.,]\d{2,3})[ \t]*(?:eur|€)?[ \t]*/[ \t]*"# + literUnit, in: text
        ).compactMap { NumberParsing.decimal(from: $0[1]) }.first { (0.3...5).contains($0) }
        if let direct { return direct }

        let keywords = ["preis/l", "eur/l", "€/l", "literpreis", "preis je l", "pro liter", "grundpreis"]
        for line in lines where keywords.contains(where: line.lowercased().contains) {
            let value = NumberParsing.captures(of: #"(?<![\d.,])(\d[.,]\d{3})(?!\d)"#, in: line)
                .compactMap { NumberParsing.decimal(from: $0[1]) }
                .first { (0.3...5).contains($0) }
            if let value { return value }
        }
        return nil
    }

    static func total(in lines: [String]) -> Double? {
        let keywords = ["zu zahlen", "endbetrag", "gesamtbetrag", "summe", "gesamt", "total", "betrag"]
        let excluded = ["netto", "mwst", "ust", "steuer", "rückgeld", "gegeben", "zwischensumme"]

        for keyword in keywords {
            for (index, line) in lines.enumerated() {
                let lower = line.lowercased()
                guard lower.contains(keyword), !excluded.contains(where: lower.contains) else { continue }
                if let amount = lastAmount(in: line) { return amount }
                if index + 1 < lines.count, let amount = lastAmount(in: lines[index + 1]) { return amount }
            }
        }
        return nil
    }

    static func date(in text: String) -> Date? {
        for match in NumberParsing.captures(of: #"(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?!\d)"#, in: text) {
            guard let day = Int(match[1]), let month = Int(match[2]), var year = Int(match[3]),
                  (1...31).contains(day), (1...12).contains(month) else { continue }
            if year < 100 { year += 2000 }
            guard (2000...2100).contains(year) else { continue }
            var components = DateComponents()
            components.day = day
            components.month = month
            components.year = year
            components.hour = 12
            if let date = Calendar(identifier: .gregorian).date(from: components) { return date }
        }
        return nil
    }

    static func station(in lines: [String]) -> String? {
        for line in lines.prefix(6) where line.rangeOfCharacter(from: .decimalDigits) == nil {
            for brand in brands {
                let pattern = #"\b"# + NSRegularExpression.escapedPattern(for: brand) + #"\b"#
                if !NumberParsing.captures(of: pattern, in: line).isEmpty { return brand }
            }
        }
        return nil
    }

    private static func lastAmount(in line: String) -> Double? {
        NumberParsing.captures(of: moneyPattern, in: line)
            .compactMap { NumberParsing.decimal(from: $0[1]) }
            .last
    }
}
