import XCTest
@testable import MotoLog

final class ReceiptParserTests: XCTestCase {
    func testGermanReceipt() {
        let lines = [
            "ARAL Tankstelle",
            "Musterstr. 1",
            "Datum: 14.06.2026 12:31",
            "Super E10",
            "15,42 l x 1,859 EUR/l",
            "28,67 EUR",
            "Summe EUR 28,67",
            "Bar 30,00",
            "Rückgeld 1,33",
            "MwSt 19% 4,58",
        ]
        let data = ReceiptParser.parse(lines: lines)
        XCTAssertEqual(data.liters, 15.42)
        XCTAssertEqual(data.pricePerLiter, 1.859)
        XCTAssertEqual(data.totalPrice, 28.67)
        XCTAssertEqual(data.station, "Aral")
        let components = Calendar(identifier: .gregorian).dateComponents([.day, .month, .year], from: data.date!)
        XCTAssertEqual(components.day, 14)
        XCTAssertEqual(components.month, 6)
        XCTAssertEqual(components.year, 2026)
    }

    func testKeywordLayoutWithDots() {
        let lines = ["Shell", "Menge 12.50 L", "Preis/L 1.799", "Total 22.49"]
        let data = ReceiptParser.parse(lines: lines)
        XCTAssertEqual(data.liters, 12.5)
        XCTAssertEqual(data.pricePerLiter, 1.799)
        XCTAssertEqual(data.totalPrice, 22.49)
        XCTAssertEqual(data.station, "Shell")
    }

    func testComputesMissingTotal() {
        let data = ReceiptParser.parse(lines: ["15,42 l x 1,859 €/l"])
        XCTAssertEqual(data.totalPrice, 28.67)
    }

    func testAmountOnNextLine() {
        let data = ReceiptParser.parse(lines: ["Zu zahlen", "EUR 41,10"])
        XCTAssertEqual(data.totalPrice, 41.10)
    }

    func testEmptyReceipt() {
        XCTAssertTrue(ReceiptParser.parse(lines: ["Vielen Dank", "Gute Fahrt"]).isEmpty)
    }
}
