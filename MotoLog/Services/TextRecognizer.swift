import UIKit
import Vision

enum TextRecognizer {
    /// Erkennt Text auf einem Foto – komplett auf dem Gerät, ohne Internet.
    static func recognize(in image: UIImage) async throws -> [RecognizedText] {
        let normalized = image.downscaled(maxDimension: 2400)
        guard let cgImage = normalized.cgImage else { return [] }

        return try await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = false
            request.recognitionLanguages = ["de-DE", "en-US"]

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try handler.perform([request])

            return (request.results ?? []).compactMap { observation -> RecognizedText? in
                guard let candidate = observation.topCandidates(1).first else { return nil }
                let box = observation.boundingBox
                return RecognizedText(text: candidate.string,
                                      x: Double(box.midX),
                                      y: Double(box.midY),
                                      height: Double(box.height))
            }
        }.value
    }
}
