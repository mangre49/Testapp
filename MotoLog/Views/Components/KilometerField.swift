import SwiftUI

struct KilometerField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", text: $text)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 140)
            Text("km").foregroundStyle(.secondary)
        }
    }
}

struct DecimalField: View {
    let title: String
    @Binding var text: String
    let unit: String

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0,00", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 140)
            Text(unit).foregroundStyle(.secondary)
        }
    }
}

extension View {
    /// Zeigt einen Hinweis-Dialog, solange `message` nicht nil ist.
    func messageAlert(_ title: String, message: Binding<String?>) -> some View {
        alert(title, isPresented: Binding(get: { message.wrappedValue != nil },
                                          set: { if !$0 { message.wrappedValue = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(message.wrappedValue ?? "")
        }
    }
}
