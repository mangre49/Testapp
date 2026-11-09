import UIKit

extension UIImage {
    /// Verkleinert das Bild und richtet es aufrecht aus.
    func downscaled(maxDimension: CGFloat) -> UIImage {
        let largest = max(size.width, size.height)
        let scale = largest > maxDimension ? maxDimension / largest : 1
        let newSize = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: newSize, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: newSize))
        }
    }

    /// Platzsparendes JPEG für die Ablage in der Datenbank.
    func jpegForStorage() -> Data? {
        downscaled(maxDimension: 2000).jpegData(compressionQuality: 0.7)
    }
}
