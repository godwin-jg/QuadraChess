const io = require('socket.io-client');

// Test signaling server connection
async function testSignalingConnection() {
  console.log('🧪 Testing signaling server connection...');
  
  const serverUrl = 'http://localhost:3002';
  console.log(`📡 Connecting to: ${serverUrl}`);
  
  const socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('❌ Connection timeout after 10 seconds');
      socket.disconnect();
      reject(new Error('Connection timeout'));
    }, 10000);

    socket.on('connect', () => {
      console.log('✅ Connected to signaling server successfully!');
      clearTimeout(timeout);
      
      // Test game discovery
      socket.emit('discover-games');
      
      socket.on('games-list', (games) => {
        console.log('📋 Available games:', games);
        socket.disconnect();
        resolve(games);
      });
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
    });
  });
}

// Run the test
testSignalingConnection()
  .then((games) => {
    console.log('🎉 Signaling server test completed successfully!');
    console.log(`📊 Found ${games.length} available games`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Signaling server test failed:', error.message);
    process.exit(1);
  });
