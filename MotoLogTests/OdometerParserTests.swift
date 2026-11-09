import XCTest
@testable import MotoLog

final class OdometerParserTests: XCTestCase {
    func testPrefersLargeOdometerOverSpeedScale() {
        let texts = [
            RecognizedText(text: "120", height: 0.03),
            RecognizedText(text: "km/h", height: 0.02),
            RecognizedText(text: "012345", height: 0.08),
        ]
        XCTAssertEqual(OdometerParser.bestReading(from: texts), 12345)
    }

    func testThousandsSeparator() {
        XCTAssertEqual(OdometerParser.bestReading(from: [RecognizedText(text: "ODO 23.456 km", height: 0.05)]), 23456)
        XCTAssertEqual(OdometerParser.bestReading(from: [RecognizedText(text: "23 456 km", height: 0.05)]), 23456)
    }

    func testIgnoresTripMeterWithDecimal() {
        let texts = [
            RecognizedText(text: "TRIP 123.4", height: 0.06),
            RecognizedText(text: "45678", height: 0.05),
        ]
        XCTAssertEqual(OdometerParser.bestReading(from: texts), 45678)
    }

    func testFixesConfusedCharacters() {
        XCTAssertEqual(OdometerParser.bestReading(from: [RecognizedText(text: "4S67B", height: 0.05)]), 45678)
    }

    func testMinimumHintPrefersPlausibleValue() {
        let texts = [
            RecognizedText(text: "98765", height: 0.05),
            RecognizedText(text: "23456", height: 0.05),
        ]
        XCTAssertEqual(OdometerParser.bestReading(from: texts, atLeast: 23000), 23456)
    }

    func testNoNumberFound() {
        XCTAssertNil(OdometerParser.bestReading(from: [RecognizedText(text: "FUEL", height: 0.05)]))
    }
}
