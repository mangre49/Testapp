import Foundation

/// Sucht auf einem Tachofoto den wahrscheinlichsten Gesamtkilometerstand.
enum OdometerParser {
    struct Candidate: Equatable {
        let value: Int
        let score: Double
    }

    /// - Parameter minimum: zuletzt bekannter Kilometerstand – Werte darunter sind unwahrscheinlich.
    static func bestReading(from texts: [RecognizedText], atLeast minimum: Int? = nil) -> Int? {
        candidates(from: texts, atLeast: minimum).first?.value
    }

    static func candidates(from texts: [RecognizedText], atLeast minimum: Int? = nil) -> [Candidate] {
        var result: [Candidate] = []

        for item in texts {
            let lower = item.text.lowercased()
            let isScaleLabel = ["km/h", "mph", "rpm", "x1000", "1/min"].contains { lower.contains($0) }
            let cleaned = normalizeConfusables(item.text)

            // "12.345" / "12 345" (Tausendertrenner) oder einfache Zahlen, ggf. mit Dezimalteil
            let tokens = NumberParsing.captures(
                of: #"\d{1,3}(?:[ .'’]\d{3})+(?!\d)|\d+(?:[.,]\d+)?"#, in: cleaned, options: []
            ).map { $0[0] }

            for token in tokens {
                // Tageskilometerzähler wie "123.4" oder "56,78" überspringen
                if !NumberParsing.captures(of: #"[.,]\d{1,2}$"#, in: token, options: []).isEmpty { continue }

                let digits = token.filter { $0.isASCII && $0.isNumber }
                guard (3...7).contains(digits.count), let value = Int(digits) else { continue }

                var score = Double(digits.count) * 10 + item.height * 100
                if digits.count >= 5 { score += 10 }
                if lower.contains("km") && !isScaleLabel { score += 15 }
                if lower.contains("trip") { score -= 25 }
                if isScaleLabel { score -= 30 }
                if tokens.count >= 3 { score -= 30 } // Skala wie "20 40 60 80"

                if let minimum {
                    if value < minimum {
                        score -= 50
                    } else if value - minimum <= 5000 {
                        score += 20
                    }
                }
                result.append(Candidate(value: value, score: score))
            }
        }
        return result.sorted { $0.score > $1.score }
    }

    /// Typische OCR-Verwechsler in überwiegend numerischen Wörtern korrigieren (O→0, I→1, S→5 …).
    static func normalizeConfusables(_ text: String) -> String {
        let map: [Character: Character] = ["O": "0", "o": "0", "D": "0", "I": "1", "l": "1", "|": "1",
                                           "S": "5", "s": "5", "B": "8", "Z": "2"]
        return text.split(separator: " ", omittingEmptySubsequences: false).map { word -> String in
            let digitCount = word.filter { $0.isASCII && $0.isNumber }.count
            guard word.count >= 3, Double(digitCount) / Double(word.count) >= 0.5 else { return String(word) }
            return String(word.map { map[$0] ?? $0 })
        }.joined(separator: " ")
    }
}
