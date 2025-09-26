const io = require("socket.io-client");

// Test script for P2P signaling server
console.log("Testing P2P Signaling Server...");

const signalingServerUrl = "http://localhost:3002";

// Test 1: Connect to signaling server
console.log("\n1. Testing connection to signaling server...");
const client1 = io(signalingServerUrl);

client1.on("connect", () => {
  console.log("✅ Connected to signaling server");

  // Test 2: Register as host
  console.log("\n2. Testing host registration...");
  client1.emit("register-peer", {
    peerId: "test-peer-1",
    gameId: "test-game-1",
    isHost: true,
    hostName: "Test Host",
  });

  // Test 3: Discover games
  console.log("\n3. Testing game discovery...");
  client1.emit("discover-games");

  client1.on("games-list", (games) => {
    console.log("✅ Games discovered:", games);

    // Test 4: Register as player
    console.log("\n4. Testing player registration...");
    const client2 = io(signalingServerUrl);

    client2.on("connect", () => {
      console.log("✅ Second client connected");

      client2.emit("register-peer", {
        peerId: "test-peer-2",
        gameId: "test-game-1",
        isHost: false,
        hostName: "Test Player",
      });

      // Test 5: Join game
      console.log("\n5. Testing game join...");
      client2.emit("join-game", {
        gameId: "test-game-1",
        playerName: "Test Player",
      });

      client2.on("player-joined", (data) => {
        console.log("✅ Player joined:", data);

        // Test 6: Send offer/answer
        console.log("\n6. Testing offer/answer exchange...");
        const testOffer = {
          type: "offer",
          sdp: "test-sdp",
        };

        client1.emit("offer", {
          targetPeerId: "test-peer-2",
          offer: testOffer,
        });

        client2.on("offer", (data) => {
          console.log("✅ Offer received by client2:", data);

          // Send answer
          const testAnswer = {
            type: "answer",
            sdp: "test-answer-sdp",
          };

          client2.emit("answer", {
            targetPeerId: "test-peer-1",
            answer: testAnswer,
          });
        });

        client1.on("answer", (data) => {
          console.log("✅ Answer received by client1:", data);
          console.log(
            "\n✅ All tests passed! P2P signaling server is working correctly."
          );

          // Cleanup
          setTimeout(() => {
            client1.disconnect();
            client2.disconnect();
            process.exit(0);
          }, 1000);
        });
      });
    });
  });
});

client1.on("connect_error", (error) => {
  console.error("❌ Failed to connect to signaling server:", error.message);
  console.log(
    "Make sure the signaling server is running: npm run signaling-server"
  );
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error("❌ Test timeout - signaling server may not be running");
  process.exit(1);
}, 10000);
