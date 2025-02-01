import { useState } from "react";
import "../App.css"; // Import CSS for styling

export const Receiver = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [pc, setPC] = useState<RTCPeerConnection | null>(null);
  const [roomId, setRoomId] = useState("");

  const joinRoom = () => {
    const socket = new WebSocket("ws://localhost:8080");
    setSocket(socket);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "joinRoom", roomId, role: "receiver" }));
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

    // Add local media stream (receiver's own camera)
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
    localVideo.play();
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Handle remote media stream (sender's video or screen share)
    pc.ontrack = (event) => {
      if (event.track.kind === "video") {
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.play();
      }
    };

    // Handle signaling messages
    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "createOffer") {
        await pc.setRemoteDescription(message.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: "createAnswer", sdp: answer, roomId }));
      } else if (message.type === "iceCandidate") {
        pc.addIceCandidate(message.candidate);
      } else if (message.type === "participantLeft") {
        console.log("A participant has left the room");

        // Clear only the remote video
        remoteVideo.srcObject = null;
      }
    };

    // Send ICE candidates to the sender
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(
          JSON.stringify({ type: "iceCandidate", candidate: event.candidate, roomId })
        );
      }
    };
  };

  return (
    <div className="container">
      <h1>Receiver</h1>
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
      </div>
      <div className="video-container">
        <video id="localVideo" muted autoPlay></video>
        <video id="remoteVideo" autoPlay></video>
      </div>
    </div>
  );
};