import XCTest
@testable import MotoLog

final class HelperTests: XCTestCase {
    func testDecimalParsing() {
        XCTAssertEqual(NumberParsing.decimal(from: "45,23"), 45.23)
        XCTAssertEqual(NumberParsing.decimal(from: "45.23"), 45.23)
        XCTAssertEqual(NumberParsing.decimal(from: "1.234,56"), 1234.56)
        XCTAssertEqual(NumberParsing.decimal(from: "1,234.56"), 1234.56)
        XCTAssertNil(NumberParsing.decimal(from: ""))
    }

    func testIntegerParsing() {
        XCTAssertEqual(NumberParsing.integer(from: "12.345"), 12345)
        XCTAssertNil(NumberParsing.integer(from: "abc"))
    }

    func testLineGrouping() {
        let items = [
            RecognizedText(text: "28,67", x: 0.8, y: 0.50, height: 0.02),
            RecognizedText(text: "Summe", x: 0.1, y: 0.505, height: 0.02),
            RecognizedText(text: "ARAL", x: 0.5, y: 0.90, height: 0.03),
        ]
        XCTAssertEqual(TextLayout.lines(from: items), ["ARAL", "Summe  28,67"])
    }

    func testAverageConsumptionFullTankMethod() {
        let readings = [
            FuelReading(odometerKm: 10_000, liters: 14, isFullTank: true),
            FuelReading(odometerKm: 10_150, liters: 5, isFullTank: false),
            FuelReading(odometerKm: 10_300, liters: 10, isFullTank: true),
        ]
        // (5 + 10) l auf 300 km = 5,0 l/100 km
        XCTAssertEqual(FuelStatistics.averageConsumption(readings)!, 5.0, accuracy: 0.001)
    }

    func testAverageConsumptionNeedsTwoFullTanks() {
        XCTAssertNil(FuelStatistics.averageConsumption([FuelReading(odometerKm: 1, liters: 10, isFullTank: true)]))
    }
}
