const WebSocket = require('ws');

let blockId = 6;
let clientId = 0;
let world = [];
let players = {};

// Generate world blocks
for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
        world.push({x: i * 50, y: 0, z: j * 50, type: 8, id: blockId});
        blockId += 6;
    }
}

// Array to keep track of all connected clients
const clients = [];

// WebSocket server setup
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const wss = new WebSocket.Server({ port: PORT, host: HOST, path: '/craft' });

wss.on('connection', (ws) => {
    console.log('New player connected');
    
    ws.id = clientId++;
    players[ws.id] = {x: 0, y: 0, z: 0, r: 0};

    const joinMsg = {action: "join", id: ws.id, x: 0, y: 0, z: 0, r: 0};
    broadcastMessage(joinMsg);

    // Add the new client to the clients array
    clients.push(ws);

    let playersMsg = Object.entries(players).map(e => {
        return {id: e[0], x: e[1].x, y: e[1].y, z: e[1].z, r: e[1].r};
    }).filter(e => e.id != ws.id);

    const worldMsg = {action: "load", world, players: playersMsg};
    ws.send(JSON.stringify(worldMsg));

    // Handle incoming messages from clients
    ws.on('message', (data) => {
        try {
            const messageStr = data.toString().trim();
            // Check if the data is JSON
            if (messageStr.startsWith("{") && messageStr.endsWith("}")) {
                const message = JSON.parse(messageStr);

                // Process the message
                if (message.action === 'place') {
                    message.id = blockId;
                    blockId += 6;
                    world.push(message);
                    broadcastMessage(message);
                    setTimeout(() => {
                        broadcastMessage(message);
                    }, 100);
                } else if (message.action === 'remove') {
                    broadcastMessage(message);
                    setTimeout(() => {
                        broadcastMessage(message);
                    }, 100);
                } else if (message.action === 'move') {
                    message.id = ws.id;
                    broadcastMessage(message);
                }
            } else {
                console.warn("Non-JSON data received:", messageStr);
            }
        } catch (err) {
            console.error("Error parsing message:", err);
        }
    });

    // Handle connection close
    ws.on('close', () => {
        console.log('Client disconnected');
        delete players[ws.id];
        broadcastMessage({action: "leave", id: ws.id});

        // Remove the client from the clients array
        const index = clients.indexOf(ws);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    });

    // Handle errors
    ws.on('error', (err) => {
        console.error("WebSocket error:", err);
        
        // Ensure cleanup
        const index = clients.indexOf(ws);
        if (index !== -1) {
            clients.splice(index, 1);
        }
        delete players[ws.id];
    });
});

console.log(`WebSocket server running at ws://localhost:${PORT}/craft`);

// Function to broadcast a message to all clients
function broadcastMessage(message) {
    // Convert the message to a JSON string
    const messageStr = JSON.stringify(message);

    // Send the message to all connected clients
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            if (message.action === "move" && client.id === message.id) return;
            try {
                client.send(messageStr);
            } catch (err) {
                console.error(`Error sending message to client ${client.id}:`, err);
            }
        }
    });
}
