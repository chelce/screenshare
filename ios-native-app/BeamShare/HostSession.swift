// HostSession.swift
// Main session manager that coordinates WebSocket, WebRTC, and screen capture

import Foundation
import WebRTC

enum HostStatus {
    case idle
    case requestingPermission
    case connecting
    case waiting
    case live
}

class HostSession: ObservableObject {
    @Published var status: HostStatus = .idle
    @Published var roomCode: String?
    @Published var viewerCount: Int = 0
    @Published var errorMessage: String?
    
    private let webSocketManager = WebSocketManager()
    private let webRTCManager = WebRTCManager()
    private let screenCaptureManager = ScreenCaptureManager()
    
    private var readyViewers = Set<String>()
    
    init() {
        setupWebSocket()
        setupWebRTC()
        setupScreenCapture()
    }
    
    // MARK: - Setup
    
    private func setupWebSocket() {
        webSocketManager.onConnect = { [weak self] in
            print("[HostSession] WebSocket connected, registering as host")
            self?.webSocketManager.send(.registerHost)
        }
        
        webSocketManager.onMessage = { [weak self] message in
            self?.handleSignalingMessage(message)
        }
        
        webSocketManager.onDisconnect = { [weak self] in
            print("[HostSession] WebSocket disconnected")
            self?.cleanup()
        }
    }
    
    private func setupWebRTC() {
        webRTCManager.onIceCandidate = { [weak self] viewerId, candidate in
            self?.sendIceCandidateToViewer(viewerId: viewerId, candidate: candidate)
        }
        
        webRTCManager.onConnectionStateChange = { [weak self] viewerId, state in
            if state == .connected {
                self?.readyViewers.insert(viewerId)
                self?.updateViewerCount()
                self?.updateStatus()
            } else if state == .failed || state == .closed {
                self?.readyViewers.remove(viewerId)
                self?.updateViewerCount()
            }
        }
    }
    
    private func setupScreenCapture() {
        screenCaptureManager.onError = { [weak self] error in
            print("[HostSession] Screen capture error: \(error)")
            self?.errorMessage = error
        }
    }
    
    // MARK: - Public API
    
    func startSharing() {
        status = .requestingPermission
        errorMessage = nil
        
        let videoSource = webRTCManager.getVideoSource()
        webRTCManager.setupLocalMedia(videoSource: videoSource)
        
        screenCaptureManager.startCapture(videoSource: videoSource) { [weak self] success, error in
            guard let self = self else { return }
            
            if success {
                self.status = .connecting
                self.webSocketManager.connect()
            } else {
                self.errorMessage = error ?? "Failed to start screen capture"
                self.status = .idle
            }
        }
    }
    
    func stopSharing() {
        webSocketManager.send(.leaveRoom)
        cleanup()
    }
    
    // MARK: - Signaling Message Handling
    
    private func handleSignalingMessage(_ message: SignalingInboundMessage) {
        switch message {
        case .roomRegistered(let code):
            print("[HostSession] Room registered: \(code)")
            DispatchQueue.main.async {
                self.roomCode = code
                self.status = .waiting
            }
            
        case .viewerJoined(let viewerId):
            print("[HostSession] Viewer joined: \(viewerId)")
            
        case .viewerLeft(let viewerId):
            print("[HostSession] Viewer left: \(viewerId)")
            webRTCManager.removePeerConnection(for: viewerId)
            readyViewers.remove(viewerId)
            updateViewerCount()
            
        case .signal(let from, let payload, let viewerId):
            guard from == "viewer", let viewerId = viewerId else { return }
            handleViewerSignal(viewerId: viewerId, payload: payload)
            
        case .error(let reason, let recoverable):
            print("[HostSession] Server error: \(reason)")
            DispatchQueue.main.async {
                self.errorMessage = reason
                if recoverable != true {
                    self.cleanup()
                }
            }
            
        default:
            break
        }
    }
    
    private func handleViewerSignal(viewerId: String, payload: SignalPayload) {
        switch payload.kind {
        case .offer:
            guard let description = payload.description else { return }
            webRTCManager.handleRemoteOffer(description, from: viewerId) { [weak self] answer in
                guard let answer = answer else { return }
                self?.sendAnswerToViewer(viewerId: viewerId, answer: answer)
            }
            
        case .iceCandidate:
            guard let candidate = payload.candidate else { return }
            webRTCManager.handleRemoteIceCandidate(candidate, from: viewerId)
            
        default:
            break
        }
    }
    
    // MARK: - Sending Signals
    
    private func sendAnswerToViewer(viewerId: String, answer: RTCSessionDescription) {
        let descriptionData = RTCSessionDescriptionData(
            type: answer.type.string,
            sdp: answer.sdp
        )
        
        let payload = SignalPayload(
            kind: .answer,
            description: descriptionData,
            candidate: nil
        )
        
        webSocketManager.send(.signalViewer(viewerId: viewerId, payload: payload))
    }
    
    private func sendIceCandidateToViewer(viewerId: String, candidate: RTCIceCandidate) {
        let candidateData = RTCIceCandidateData(
            candidate: candidate.sdp,
            sdpMLineIndex: candidate.sdpMLineIndex,
            sdpMid: candidate.sdpMid
        )
        
        let payload = SignalPayload(
            kind: .iceCandidate,
            description: nil,
            candidate: candidateData
        )
        
        webSocketManager.send(.signalViewer(viewerId: viewerId, payload: payload))
    }
    
    // MARK: - Helpers
    
    private func updateViewerCount() {
        DispatchQueue.main.async {
            self.viewerCount = self.readyViewers.count
        }
    }
    
    private func updateStatus() {
        DispatchQueue.main.async {
            if self.viewerCount > 0 && self.status == .waiting {
                self.status = .live
            }
        }
    }
    
    private func cleanup() {
        screenCaptureManager.stopCapture { [weak self] in
            self?.webRTCManager.cleanup()
            self?.webSocketManager.disconnect()
            
            DispatchQueue.main.async {
                self?.status = .idle
                self?.roomCode = nil
                self?.viewerCount = 0
                self?.readyViewers.removeAll()
            }
        }
    }
}

// MARK: - RTCSdpType Extension

extension RTCSdpType {
    var string: String {
        switch self {
        case .offer: return "offer"
        case .prAnswer: return "pranswer"
        case .answer: return "answer"
        case .rollback: return "rollback"
        @unknown default: return "unknown"
        }
    }
    
    init(rawValue: String) {
        switch rawValue.lowercased() {
        case "offer": self = .offer
        case "pranswer": self = .prAnswer
        case "answer": self = .answer
        case "rollback": self = .rollback
        default: self = .offer
        }
    }
}
