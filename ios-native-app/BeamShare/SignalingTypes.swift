// SignalingTypes.swift
// Message types that match your Railway WebSocket server

import Foundation

// MARK: - Signal Payloads

enum SignalKind: String, Codable {
    case offer
    case answer
    case iceCandidate = "ice-candidate"
}

struct SignalPayload: Codable {
    let kind: SignalKind
    let description: RTCSessionDescriptionData?
    let candidate: RTCIceCandidateData?
    
    enum CodingKeys: String, CodingKey {
        case kind
        case description
        case candidate
    }
}

struct RTCSessionDescriptionData: Codable {
    let type: String
    let sdp: String
}

struct RTCIceCandidateData: Codable {
    let candidate: String
    let sdpMLineIndex: Int32
    let sdpMid: String?
}

// MARK: - Outbound Messages (Client → Server)

enum SignalingOutboundMessage: Codable {
    case registerHost
    case joinRoom(code: String)
    case leaveRoom
    case signalHost(payload: SignalPayload)
    case signalViewer(viewerId: String, payload: SignalPayload)
    
    enum CodingKeys: String, CodingKey {
        case type
        case code
        case viewerId
        case payload
    }
    
    enum MessageType: String, Codable {
        case registerHost = "register-host"
        case joinRoom = "join-room"
        case leaveRoom = "leave-room"
        case signalHost = "signal-host"
        case signalViewer = "signal-viewer"
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        switch self {
        case .registerHost:
            try container.encode(MessageType.registerHost.rawValue, forKey: .type)
        case .joinRoom(let code):
            try container.encode(MessageType.joinRoom.rawValue, forKey: .type)
            try container.encode(code, forKey: .code)
        case .leaveRoom:
            try container.encode(MessageType.leaveRoom.rawValue, forKey: .type)
        case .signalHost(let payload):
            try container.encode(MessageType.signalHost.rawValue, forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .signalViewer(let viewerId, let payload):
            try container.encode(MessageType.signalViewer.rawValue, forKey: .type)
            try container.encode(viewerId, forKey: .viewerId)
            try container.encode(payload, forKey: .payload)
        }
    }
}

// MARK: - Inbound Messages (Server → Client)

enum SignalingInboundMessage: Codable {
    case roomRegistered(code: String)
    case roomJoined(code: String, viewerId: String)
    case roomClosed
    case viewerJoined(viewerId: String)
    case viewerLeft(viewerId: String)
    case signal(from: String, payload: SignalPayload, viewerId: String?)
    case error(reason: String, recoverable: Bool?)
    
    enum CodingKeys: String, CodingKey {
        case type
        case code
        case viewerId
        case from
        case payload
        case reason
        case recoverable
    }
    
    enum MessageType: String, Codable {
        case roomRegistered = "room-registered"
        case roomJoined = "room-joined"
        case roomClosed = "room-closed"
        case viewerJoined = "viewer-joined"
        case viewerLeft = "viewer-left"
        case signal = "signal"
        case error = "error"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let typeString = try container.decode(String.self, forKey: .type)
        
        guard let type = MessageType(rawValue: typeString) else {
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown message type: \(typeString)"
            )
        }
        
        switch type {
        case .roomRegistered:
            let code = try container.decode(String.self, forKey: .code)
            self = .roomRegistered(code: code)
        case .roomJoined:
            let code = try container.decode(String.self, forKey: .code)
            let viewerId = try container.decode(String.self, forKey: .viewerId)
            self = .roomJoined(code: code, viewerId: viewerId)
        case .roomClosed:
            self = .roomClosed
        case .viewerJoined:
            let viewerId = try container.decode(String.self, forKey: .viewerId)
            self = .viewerJoined(viewerId: viewerId)
        case .viewerLeft:
            let viewerId = try container.decode(String.self, forKey: .viewerId)
            self = .viewerLeft(viewerId: viewerId)
        case .signal:
            let from = try container.decode(String.self, forKey: .from)
            let payload = try container.decode(SignalPayload.self, forKey: .payload)
            let viewerId = try container.decodeIfPresent(String.self, forKey: .viewerId)
            self = .signal(from: from, payload: payload, viewerId: viewerId)
        case .error:
            let reason = try container.decode(String.self, forKey: .reason)
            let recoverable = try container.decodeIfPresent(Bool.self, forKey: .recoverable)
            self = .error(reason: reason, recoverable: recoverable)
        }
    }
}
