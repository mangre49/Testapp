import PhotosUI
import SwiftUI

/// Foto aufnehmen oder aus der Mediathek wählen, mit Vorschau.
struct PhotoCaptureView: View {
    @Binding var imageData: Data?
    var isProcessing = false
    var onNewImage: (UIImage) -> Void = { _ in }

    @State private var showCamera = false
    @State private var pickerItem: PhotosPickerItem?
    @State private var showFullScreen = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let imageData, let image = UIImage(data: imageData) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .onTapGesture { showFullScreen = true }
            }
            HStack(spacing: 16) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button { showCamera = true } label: {
                        Label("Kamera", systemImage: "camera")
                    }
                }
                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Label("Mediathek", systemImage: "photo.on.rectangle")
                }
                Spacer()
                if isProcessing {
                    ProgressView()
                } else if imageData != nil {
                    Button(role: .destructive) { imageData = nil } label: {
                        Image(systemName: "trash")
                    }
                    .accessibilityLabel("Foto entfernen")
                }
            }
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 4)
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { handle($0) }
                .ignoresSafeArea()
        }
        .sheet(isPresented: $showFullScreen) {
            if let imageData, let image = UIImage(data: imageData) {
                ZoomablePhotoView(image: image)
            }
        }
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    handle(image)
                }
                pickerItem = nil
            }
        }
    }

    private func handle(_ image: UIImage) {
        imageData = image.jpegForStorage()
        onNewImage(image)
    }
}

/// Vollbildansicht mit Zoom (z. B. um eine Quittung zu lesen).
struct ZoomablePhotoView: View {
    let image: UIImage
    @Environment(\.dismiss) private var dismiss
    @State private var scale: CGFloat = 1

    var body: some View {
        NavigationStack {
            ScrollView([.horizontal, .vertical]) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(width: UIScreen.main.bounds.width * scale)
            }
            .gesture(MagnifyGesture().onChanged { scale = min(max($0.magnification, 1), 5) })
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
        }
    }
}

/// Kleine Vorschau für Listen.
struct PhotoThumbnail: View {
    let data: Data?
    var systemImage = "photo"

    var body: some View {
        Group {
            if let data, let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Image(systemName: systemImage)
                    .font(.title2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.secondarySystemBackground))
            }
        }
        .frame(width: 52, height: 52)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

/// Reine Fotoanzeige (antippen für Vollbild/Zoom).
struct PhotoPreview: View {
    let data: Data
    var caption: String?
    @State private var showFullScreen = false

    var body: some View {
        if let image = UIImage(data: data) {
            VStack(alignment: .leading, spacing: 6) {
                if let caption {
                    Text(caption).font(.caption).foregroundStyle(.secondary)
                }
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: 240)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .onTapGesture { showFullScreen = true }
            }
            .sheet(isPresented: $showFullScreen) { ZoomablePhotoView(image: image) }
        }
    }
}
