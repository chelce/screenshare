// WebSocketManager.swift
// Handles WebSocket connection to Railway signaling server

import Foundation

class WebSocketManager: NSObject, ObservableObject {
    private let signalingURL = "wss://beamshare-signaling-production.up.railway.app"
    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession?
    
    var onMessage: ((SignalingInboundMessage) -> Void)?
    var onConnect: (() -> Void)?
    var onDisconnect: (() -> Void)?
    
    @Published var isConnected = false
    
    override init() {
        super.init()
        self.session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
    }
    
    func connect() {
        guard let url = URL(string: signalingURL) else {
            print("[WebSocket] Invalid URL")
            return
        }
        
        webSocketTask = session?.webSocketTask(with: url)
        webSocketTask?.resume()
        
        receiveMessage()
        
        print("[WebSocket] Connecting to \(signalingURL)")
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        isConnected = false
        onDisconnect?()
        print("[WebSocket] Disconnected")
    }
    
    func send(_ message: SignalingOutboundMessage) {
        guard isConnected else {
            print("[WebSocket] Cannot send - not connected")
            return
        }
        
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(message),
              let jsonString = String(data: data, encoding: .utf8) else {
            print("[WebSocket] Failed to encode message")
            return
        }
        
        let message = URLSessionWebSocketTask.Message.string(jsonString)
        webSocketTask?.send(message) { error in
            if let error = error {
                print("[WebSocket] Send error: \(error.localizedDescription)")
            }
        }
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                
                // Continue receiving
                self.receiveMessage()
                
            case .failure(let error):
                print("[WebSocket] Receive error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self.isConnected = false
                    self.onDisconnect?()
                }
            }
        }
    }
    
    private func handleMessage(_ text: String) {
        let decoder = JSONDecoder()
        guard let data = text.data(using: .utf8),
              let message = try? decoder.decode(SignalingInboundMessage.self, from: data) else {
            print("[WebSocket] Failed to decode message: \(text)")
            return
        }
        
        DispatchQueue.main.async {
            self.onMessage?(message)
        }
    }
}

// MARK: - URLSessionWebSocketDelegate

extension WebSocketManager: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        print("[WebSocket] Connected")
        DispatchQueue.main.async {
            self.isConnected = true
            self.onConnect?()
        }
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        print("[WebSocket] Closed with code: \(closeCode)")
        DispatchQueue.main.async {
            self.isConnected = false
            self.onDisconnect?()
        }
    }
}
