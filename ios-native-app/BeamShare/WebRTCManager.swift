// WebRTCManager.swift
// Manages WebRTC peer connections and media streams

import Foundation
import WebRTC

class WebRTCManager: NSObject {
    private static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        let videoEncoderFactory = RTCDefaultVideoEncoderFactory()
        let videoDecoderFactory = RTCDefaultVideoDecoderFactory()
        return RTCPeerConnectionFactory(
            encoderFactory: videoEncoderFactory,
            decoderFactory: videoDecoderFactory
        )
    }()
    
    private let iceServers = [
        RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]),
        RTCIceServer(urlStrings: ["stun:stun1.l.google.com:19302"])
    ]
    
    private var peerConnections: [String: RTCPeerConnection] = [:]
    private var localVideoTrack: RTCVideoTrack?
    private var localAudioTrack: RTCAudioTrack?
    
    var onIceCandidate: ((String, RTCIceCandidate) -> Void)?
    var onConnectionStateChange: ((String, RTCPeerConnectionState) -> Void)?
    
    // MARK: - Local Media Setup
    
    func setupLocalMedia(videoSource: RTCVideoSource) {
        let audioConstraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        let audioSource = Self.factory.audioSource(with: audioConstraints)
        localAudioTrack = Self.factory.audioTrack(with: audioSource, trackId: "audio0")
        
        localVideoTrack = Self.factory.videoTrack(with: videoSource, trackId: "video0")
        
        print("[WebRTC] Local media tracks created")
    }
    
    func getVideoSource() -> RTCVideoSource {
        return Self.factory.videoSource()
    }
    
    // MARK: - Peer Connection Management
    
    func createPeerConnection(for viewerId: String) -> RTCPeerConnection? {
        let config = RTCConfiguration()
        config.iceServers = iceServers
        config.sdpSemantics = .unifiedPlan
        config.continualGatheringPolicy = .gatherContinually
        
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: ["DtlsSrtpKeyAgreement": "true"]
        )
        
        guard let peerConnection = Self.factory.peerConnection(
            with: config,
            constraints: constraints,
            delegate: nil
        ) else {
            print("[WebRTC] Failed to create peer connection for \(viewerId)")
            return nil
        }
        
        // Add tracks
        if let videoTrack = localVideoTrack {
            peerConnection.add(videoTrack, streamIds: ["stream0"])
        }
        if let audioTrack = localAudioTrack {
            peerConnection.add(audioTrack, streamIds: ["stream0"])
        }
        
        // Set up delegate
        let delegate = PeerConnectionDelegate(viewerId: viewerId, manager: self)
        objc_setAssociatedObject(peerConnection, &AssociatedKeys.delegate, delegate, .OBJC_ASSOCIATION_RETAIN)
        peerConnection.delegate = delegate
        
        peerConnections[viewerId] = peerConnection
        
        print("[WebRTC] Created peer connection for viewer: \(viewerId)")
        return peerConnection
    }
    
    func removePeerConnection(for viewerId: String) {
        peerConnections[viewerId]?.close()
        peerConnections.removeValue(forKey: viewerId)
        print("[WebRTC] Removed peer connection for viewer: \(viewerId)")
    }
    
    func getPeerConnection(for viewerId: String) -> RTCPeerConnection? {
        return peerConnections[viewerId]
    }
    
    func removeAllPeerConnections() {
        peerConnections.forEach { $0.value.close() }
        peerConnections.removeAll()
        print("[WebRTC] Removed all peer connections")
    }
    
    // MARK: - Signaling
    
    func handleRemoteOffer(_ description: RTCSessionDescriptionData, from viewerId: String, completion: @escaping (RTCSessionDescription?) -> Void) {
        let sdpType = RTCSdpType(rawValue: description.type) ?? .offer
        let sessionDescription = RTCSessionDescription(type: sdpType, sdp: description.sdp)
        
        guard let peerConnection = getPeerConnection(for: viewerId) ?? createPeerConnection(for: viewerId) else {
            completion(nil)
            return
        }
        
        peerConnection.setRemoteDescription(sessionDescription) { error in
            if let error = error {
                print("[WebRTC] Error setting remote description: \(error.localizedDescription)")
                completion(nil)
                return
            }
            
            let constraints = RTCMediaConstraints(
                mandatoryConstraints: ["OfferToReceiveAudio": "false", "OfferToReceiveVideo": "false"],
                optionalConstraints: nil
            )
            
            peerConnection.answer(for: constraints) { answer, error in
                if let error = error {
                    print("[WebRTC] Error creating answer: \(error.localizedDescription)")
                    completion(nil)
                    return
                }
                
                guard let answer = answer else {
                    completion(nil)
                    return
                }
                
                peerConnection.setLocalDescription(answer) { error in
                    if let error = error {
                        print("[WebRTC] Error setting local description: \(error.localizedDescription)")
                        completion(nil)
                        return
                    }
                    
                    completion(answer)
                }
            }
        }
    }
    
    func handleRemoteIceCandidate(_ candidateData: RTCIceCandidateData, from viewerId: String) {
        guard let peerConnection = getPeerConnection(for: viewerId) else {
            print("[WebRTC] No peer connection for viewer: \(viewerId)")
            return
        }
        
        let candidate = RTCIceCandidate(
            sdp: candidateData.candidate,
            sdpMLineIndex: candidateData.sdpMLineIndex,
            sdpMid: candidateData.sdpMid
        )
        
        peerConnection.add(candidate) { error in
            if let error = error {
                print("[WebRTC] Error adding ICE candidate: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Cleanup
    
    func cleanup() {
        removeAllPeerConnections()
        localVideoTrack = nil
        localAudioTrack = nil
    }
}

// MARK: - Peer Connection Delegate

private class PeerConnectionDelegate: NSObject, RTCPeerConnectionDelegate {
    let viewerId: String
    weak var manager: WebRTCManager?
    
    init(viewerId: String, manager: WebRTCManager) {
        self.viewerId = viewerId
        self.manager = manager
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {
        print("[WebRTC] Signaling state changed for \(viewerId): \(stateChanged.rawValue)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
        print("[WebRTC] Stream added for \(viewerId)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {
        print("[WebRTC] Stream removed for \(viewerId)")
    }
    
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {
        print("[WebRTC] Should negotiate for \(viewerId)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        print("[WebRTC] ICE connection state changed for \(viewerId): \(newState.rawValue)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {
        print("[WebRTC] ICE gathering state changed for \(viewerId): \(newState.rawValue)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        print("[WebRTC] ICE candidate generated for \(viewerId)")
        manager?.onIceCandidate?(viewerId, candidate)
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {
        print("[WebRTC] ICE candidates removed for \(viewerId)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {
        print("[WebRTC] Data channel opened for \(viewerId)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCPeerConnectionState) {
        print("[WebRTC] Peer connection state changed for \(viewerId): \(newState.rawValue)")
        manager?.onConnectionStateChange?(viewerId, newState)
    }
}

// MARK: - Associated Keys

private struct AssociatedKeys {
    static var delegate = "delegate"
}
