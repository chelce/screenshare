// ContentView.swift
// Main UI for the BeamShare iOS app

import SwiftUI

struct ContentView: View {
    @StateObject private var hostSession = HostSession()
    @State private var showStopAlert = false
    
    var body: some View {
        ZStack {
            // Background
            Color.black
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Header
                headerView
                    .padding(.top, 60)
                    .padding(.bottom, 30)
                
                Spacer()
                
                // Main Content
                VStack(spacing: 32) {
                    // Room Code Display
                    if let roomCode = hostSession.roomCode {
                        roomCodeView(code: roomCode)
                    }
                    
                    // Status Indicator
                    statusView
                    
                    // Viewer Count
                    if hostSession.viewerCount > 0 {
                        viewerCountView
                    }
                    
                    // Error Message
                    if let error = hostSession.errorMessage {
                        errorView(message: error)
                    }
                    
                    Spacer()
                    
                    // Start/Stop Button
                    actionButton
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }
        }
        .alert("Stop Sharing", isPresented: $showStopAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Stop", role: .destructive) {
                hostSession.stopSharing()
            }
        } message: {
            Text("Are you sure you want to stop sharing?")
        }
    }
    
    // MARK: - Header
    
    private var headerView: some View {
        VStack(spacing: 4) {
            Text("BeamShare")
                .font(.system(size: 32, weight: .bold))
                .foregroundColor(.white)
            
            Text("iOS Screen Sharing")
                .font(.system(size: 14))
                .foregroundColor(.gray)
        }
    }
    
    // MARK: - Room Code
    
    private func roomCodeView(code: String) -> some View {
        VStack(spacing: 8) {
            Text("ROOM CODE")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.gray)
                .tracking(1)
            
            Text(code)
                .font(.system(size: 48, weight: .bold))
                .foregroundColor(.white)
                .tracking(8)
            
            Text("Share this code with viewers")
                .font(.system(size: 12))
                .foregroundColor(.gray.opacity(0.7))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(white: 0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color(white: 0.2), lineWidth: 2)
                )
        )
    }
    
    // MARK: - Status
    
    private var statusView: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(statusColor)
                .frame(width: 12, height: 12)
            
            Text(statusText)
                .font(.system(size: 16))
                .foregroundColor(.gray)
        }
    }
    
    private var statusColor: Color {
        switch hostSession.status {
        case .idle:
            return Color(white: 0.3)
        case .requestingPermission, .connecting:
            return .orange
        case .waiting:
            return .orange
        case .live:
            return .green
        }
    }
    
    private var statusText: String {
        switch hostSession.status {
        case .idle:
            return "Ready to share"
        case .requestingPermission:
            return "Requesting permissions..."
        case .connecting:
            return "Connecting to server..."
        case .waiting:
            return "Waiting for viewers"
        case .live:
            return "Live"
        }
    }
    
    // MARK: - Viewer Count
    
    private var viewerCountView: some View {
        Text("\(hostSession.viewerCount) \(hostSession.viewerCount == 1 ? "viewer" : "viewers")")
            .font(.system(size: 20, weight: .semibold))
            .foregroundColor(.white)
    }
    
    // MARK: - Error
    
    private func errorView(message: String) -> some View {
        Text(message)
            .font(.system(size: 14))
            .foregroundColor(Color(red: 1.0, green: 0.4, blue: 0.4))
            .padding()
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(red: 1.0, green: 0, blue: 0, opacity: 0.12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.red, lineWidth: 1)
                    )
            )
    }
    
    // MARK: - Action Button
    
    private var actionButton: some View {
        Button(action: {
            if hostSession.status == .idle {
                hostSession.startSharing()
            } else {
                showStopAlert = true
            }
        }) {
            Text(hostSession.status == .idle ? "Start Sharing" : "Stop Sharing")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(hostSession.status == .idle ? Color.blue : Color.red)
                )
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
