import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebSocketServer } from 'ws';

async function waitForService(url: string, retries = 120, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.data?.__typename) {
          console.log(`Service at ${url} is ready.`);
          return;
        }
      }
    } catch (err) {
      // console.log(`Waiting for ${url}...`);
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  console.warn(
    `Service at ${url} not available after ${retries} attempts, starting anyway...`,
  );
}

async function bootstrap() {
  // Wait for subgraph services to be available
  await Promise.all([
    waitForService('http://user-srv:3000/user/graphql'),
    waitForService('http://auction-srv:3002/graphql'),
    waitForService('http://bidding-srv:3003/graphql'),
    waitForService('http://notification-srv:3004/graphql'),
  ]);

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = process.env.PORT_GATEWAY || 4000;
  const server = await app.listen(port, '0.0.0.0');
  console.log(`API Gateway is running on: https://bidding.test/graphql or http://localhost:${port}/graphql`);

  // WebSocket Proxy: Forward subscription connections to notification-service
  const NOTIFICATION_WS_URL = process.env.NOTIFICATION_WS_URL || 'ws://notification-srv:3004/graphql';

  const wss = new WebSocketServer({ 
    noServer: true,
    handleProtocols: (protocols) => {
      console.log(`[WS Proxy] Handshake protocols: ${Array.from(protocols)}`);
      // Favor the new protocol (graphql-transport-ws) over the old one
      if (protocols.has('graphql-transport-ws')) return 'graphql-transport-ws';
      if (protocols.has('graphql-ws')) return 'graphql-ws';
      return false;
    }
  });

  server.on('upgrade', (req, socket, head) => {
    console.log(`[WS Proxy] Upgrade request received for URL: ${req.url}`);
    
    // Support both /graphql and /graphql/
    const isGraphqlPath = req.url?.startsWith('/graphql');
    
    if (isGraphqlPath) {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        const agreedProtocol = clientWs.protocol;
        console.log(`[WS Proxy] Client connected. Protocol: ${agreedProtocol}`);
        
        const { WebSocket: WsClient } = require('ws');
        // Connect to upstream using the agreed protocol
        const upstreamWs = new WsClient(NOTIFICATION_WS_URL, agreedProtocol || undefined, {
          headers: {
            authorization: req.headers.authorization || '',
            'accept-language': req.headers['accept-language'] || 'en',
          },
        });

        const pendingMessages: any[] = [];

        // Forward messages: Client -> Upstream
        clientWs.on('message', (data) => {
          if (upstreamWs.readyState === WsClient.OPEN) {
            upstreamWs.send(data);
          } else {
            pendingMessages.push(data);
          }
        });

        // When upstream is ready, flush buffer
        upstreamWs.on('open', () => {
          console.log('[WS Proxy] Upstream connection successfully opened.');
          while (pendingMessages.length > 0) {
            upstreamWs.send(pendingMessages.shift());
          }
        });

        // Forward messages: Upstream -> Client
        upstreamWs.on('message', (data) => {
          if (clientWs.readyState === WsClient.OPEN) {
            clientWs.send(data);
          }
        });

        // Handle close/error
        const cleanup = (reason: string) => {
          console.log(`[WS Proxy] Closing connections. Reason: ${reason}`);
          if (clientWs.readyState === WsClient.OPEN) clientWs.close();
          if (upstreamWs.readyState === WsClient.OPEN) upstreamWs.close();
        };

        clientWs.on('close', () => cleanup('Client closed'));
        upstreamWs.on('close', () => cleanup('Upstream closed'));
        clientWs.on('error', (err) => cleanup(`Client error: ${err.message}`));
        upstreamWs.on('error', (err) => cleanup(`Upstream error: ${err.reason || (err as any).message}`));
      });
    } else {
      socket.destroy();
    }
  });

  console.log('WebSocket proxy for subscriptions is active on /graphql');
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed, retrying in 10s...', err.message);
  setTimeout(() => bootstrap(), 10000);
});
