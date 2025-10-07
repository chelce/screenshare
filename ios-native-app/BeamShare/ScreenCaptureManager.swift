// ScreenCaptureManager.swift
// Handles iOS screen recording using ReplayKit

import Foundation
import ReplayKit
import WebRTC

class ScreenCaptureManager: NSObject {
    private let screenRecorder = RPScreenRecorder.shared()
    private var videoSource: RTCVideoSource?
    private var isCapturing = false
    
    var onError: ((String) -> Void)?
    
    func startCapture(videoSource: RTCVideoSource, completion: @escaping (Bool, String?) -> Void) {
        guard screenRecorder.isAvailable else {
            completion(false, "Screen recording is not available on this device")
            return
        }
        
        guard !isCapturing else {
            completion(false, "Already capturing")
            return
        }
        
        self.videoSource = videoSource
        
        screenRecorder.isMicrophoneEnabled = true
        
        screenRecorder.startCapture(handler: { [weak self] sampleBuffer, bufferType, error in
            guard let self = self else { return }
            
            if let error = error {
                print("[ScreenCapture] Error: \(error.localizedDescription)")
                self.onError?(error.localizedDescription)
                return
            }
            
            // Only process video frames
            guard bufferType == .video else { return }
            
            // Convert CMSampleBuffer to CVPixelBuffer
            guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
                return
            }
            
            let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            let timeStampNs = Int64(CMTimeGetSeconds(timestamp) * 1_000_000_000)
            
            let rtcPixelBuffer = RTCCVPixelBuffer(pixelBuffer: pixelBuffer)
            let videoFrame = RTCVideoFrame(
                buffer: rtcPixelBuffer,
                rotation: ._0,
                timeStampNs: timeStampNs
            )
            
            self.videoSource?.capturer(RTCVideoCapturer(), didCapture: videoFrame)
            
        }) { [weak self] error in
            if let error = error {
                print("[ScreenCapture] Failed to start: \(error.localizedDescription)")
                completion(false, error.localizedDescription)
            } else {
                print("[ScreenCapture] Started successfully")
                self?.isCapturing = true
                completion(true, nil)
            }
        }
    }
    
    func stopCapture(completion: @escaping () -> Void) {
        guard isCapturing else {
            completion()
            return
        }
        
        screenRecorder.stopCapture { [weak self] error in
            if let error = error {
                print("[ScreenCapture] Error stopping: \(error.localizedDescription)")
            } else {
                print("[ScreenCapture] Stopped successfully")
            }
            
            self?.isCapturing = false
            self?.videoSource = nil
            completion()
        }
    }
}
