import Foundation

enum NumberParsing {
    /// Wandelt "45,23", "45.23" oder "1.234,56" in eine Zahl um.
    static func decimal(from raw: String) -> Double? {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: " ", with: "")
        guard !s.isEmpty else { return nil }
        let lastComma = s.lastIndex(of: ",")
        let lastDot = s.lastIndex(of: ".")
        switch (lastComma, lastDot) {
        case let (comma?, dot?):
            if comma > dot { // 1.234,56
                s = s.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
            } else {         // 1,234.56
                s = s.replacingOccurrences(of: ",", with: "")
            }
        case (_?, nil):
            s = s.replacingOccurrences(of: ",", with: ".")
        default:
            break
        }
        return Double(s)
    }

    /// Liest eine Ganzzahl und ignoriert Tausendertrenner ("12.345" → 12345).
    static func integer(from raw: String) -> Int? {
        let digits = raw.filter { $0.isASCII && $0.isNumber }
        return digits.isEmpty ? nil : Int(digits)
    }

    /// Alle Treffer eines regulären Ausdrucks inkl. Capture-Gruppen (Index 0 = Gesamttreffer).
    static func captures(of pattern: String, in text: String,
                         options: NSRegularExpression.Options = [.caseInsensitive]) -> [[String]] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return [] }
        let ns = text as NSString
        return regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).map { match in
            (0..<match.numberOfRanges).map { index in
                let range = match.range(at: index)
                return range.location == NSNotFound ? "" : ns.substring(with: range)
            }
        }
    }

    static func round(_ value: Double, digits: Int) -> Double {
        let factor = pow(10, Double(digits))
        return (value * factor).rounded() / factor
    }
}
