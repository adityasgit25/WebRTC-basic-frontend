import { useState } from "react";
import "../App.css"; // Import CSS for styling

export const Sender = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [pc, setPC] = useState<RTCPeerConnection | null>(null);
  const [roomId, setRoomId] = useState("");

  const joinRoom = () => {
    const socket = new WebSocket("ws://localhost:8080");
    setSocket(socket);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "joinRoom", roomId, role: "sender" }));
    };

    initiateConn(socket);
  };

  const leaveRoom = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: "leaveRoom", roomId }));
      socket.close();
      setSocket(null);
    }

    if (pc) {
      pc.close();
      setPC(null);
    }

    // Clear only the remote video
    const remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;
    remoteVideo.srcObject = null;
  };

  const initiateConn = async (socket: WebSocket) => {
    const localVideo = document.getElementById("localVideo") as HTMLVideoElement;
    const remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;

    const pc = new RTCPeerConnection();
    setPC(pc);

    // Add local media stream (sender's own camera)
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
    localVideo.play();
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Handle remote media stream (receiver's video)
    pc.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.play();
    };

    // Handle signaling messages
    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "createAnswer") {
        await pc.setRemoteDescription(message.sdp);
      } else if (message.type === "iceCandidate") {
        pc.addIceCandidate(message.candidate);
      } else if (message.type === "participantLeft") {
        console.log("A participant has left the room");

        // Clear only the remote video
        remoteVideo.srcObject = null;
      }
    };

    // Send ICE candidates to the receiver
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(
          JSON.stringify({ type: "iceCandidate", candidate: event.candidate, roomId })
        );
      }
    };

    // Create and send an offer to the receiver
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: "createOffer", sdp: offer, roomId }));
  };

  const startScreenSharing = async () => {
    if (!pc) return;

    const localVideo = document.getElementById("localVideo") as HTMLVideoElement;

    try {
      // Capture screen stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Replace the local video stream with the screen stream
      localVideo.srcObject = screenStream;

      // Replace the video track in the peer connection
      const senders = pc.getSenders();
      const videoSender = senders.find((sender) => sender.track?.kind === "video");
      if (videoSender) {
        videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
      }

      // Handle screen sharing stop
      screenStream.getVideoTracks()[0].onended = () => {
        // Switch back to the camera when screen sharing stops
        startCamera();
      };
    } catch (error) {
      console.error("Error starting screen sharing:", error);
    }
  };

  const startCamera = async () => {
    if (!pc) return;

    const localVideo = document.getElementById("localVideo") as HTMLVideoElement;

    try {
      // Capture camera stream
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Replace the local video stream with the camera stream
      localVideo.srcObject = localStream;

      // Replace the video track in the peer connection
      const senders = pc.getSenders();
      const videoSender = senders.find((sender) => sender.track?.kind === "video");
      if (videoSender) {
        videoSender.replaceTrack(localStream.getVideoTracks()[0]);
      }
    } catch (error) {
      console.error("Error starting camera:", error);
    }
  };

  return (
    <div className="container">
      <h1>Sender</h1>
      <div className="input-group">
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
      </div>
      <div className="button-group">
        <button onClick={joinRoom}>Join Room</button>
        <button onClick={leaveRoom}>Leave Room</button>
        <button onClick={startScreenSharing}>Share Screen</button>
      </div>
      <div className="video-container">
        <video id="localVideo" muted autoPlay></video>
        <video id="remoteVideo" autoPlay></video>
      </div>
    </div>
  );
};