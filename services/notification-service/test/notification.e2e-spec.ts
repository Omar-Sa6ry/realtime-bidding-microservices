import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { E2ETestContext, jc } from './utils/e2e-setup';
import { cleanDatabase } from './utils/database-cleaner';
import { EmailAdapter } from '../src/modules/notification/adapters/email.adapter';
import { createClient } from 'graphql-ws';
import { WebSocket } from 'ws';

describe('Notification Service (e2e)', () => {
  let context: E2ETestContext;
  let app: INestApplication;
  let port: number;
  const graphqlEndpoint = '/graphql';
  const testUserId = '64f1a2b3c4d5e6f7a8b9c0d1';
  let testToken: string;

  jest.setTimeout(1200000); // 20 minutes global timeout for this suite

  beforeAll(async () => {
    context = new E2ETestContext();
    await context.bootstrap();
    app = context.getApp();
    port = context.getPort();
    testToken = generateTestToken(testUserId);
  }, 1200000);

  afterAll(async () => {
    if (context) await context.shutdown();
  }, 600000);

  afterEach(async () => {
    if (app) {
      await cleanDatabase(app);
    }
    jest.clearAllMocks();
  });

  async function waitForNotification(userId: string, expectedCount: number = 1, timeout: number = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${generateTestToken(userId)}`)
        .send({ query: '{ getUserNotifications { items { type id isRead title } } }' });

      const items = res.body.data?.getUserNotifications?.items || [];
      if (items.length >= expectedCount) {
        return res;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Timed out waiting for ${expectedCount} notifications for user ${userId}`);
  }

  describe('Full NATS Integration Coverage', () => {
    const otherUserId = '64f1a2b3c4d5e6f7a8b9c0d9';

    beforeEach(() => {
      // Token is already generated in beforeAll
    });

    it('should process bid.created event correctly', async () => {
      const natsClient = context.getNatsClient();
      natsClient.publish(
        'bid.created',
        jc.encode({
          auction_id: '64f1a2b3c4d5e6f7a8b9c0d2',
          user_id: testUserId,
          amount: 1500,
        }),
      );

      const res = await waitForNotification(testUserId);

      if (res.body.errors) {
        console.error(
          'GraphQL Errors:',
          JSON.stringify(res.body.errors, null, 2),
        );
      }
      expect(res.body.data?.getUserNotifications?.items?.[0]?.type).toBe(
        'BID_PLACED',
      );
    }, 20000);

    it('should process bid.outbid event correctly', async () => {
      const natsClient = context.getNatsClient();
      natsClient.publish(
        'bid.outbid',
        jc.encode({
          user_id: testUserId,
          amount: 2000,
        }),
      );

      const res = await waitForNotification(testUserId);

      if (res.body.errors) {
        console.error(
          'Bid Outbid GraphQL Errors:',
          JSON.stringify(res.body.errors, null, 2),
        );
      }
      const items = res.body.data?.getUserNotifications?.items || [];
      expect(items.length).toBeGreaterThan(0);
      const notification = items[0];
      expect(notification.type).toBe('OUTBID');
      expect(notification.title).toBeDefined();
    }, 15000);

    it('should process bid.won event correctly', async () => {
      const natsClient = context.getNatsClient();
      natsClient.publish(
        'bid.won',
        jc.encode({
          auction_id: '64f1a2b3c4d5e6f7a8b9c0d2',
          user_id: testUserId,
          amount: 5000,
        }),
      );

      const res = await waitForNotification(testUserId);

      expect(res.body.data.getUserNotifications.items[0].type).toBe(
        'AUCTION_WON',
      );
    }, 20000);

    it('should process auction.ended event correctly', async () => {
      const natsClient = context.getNatsClient();
      natsClient.publish(
        'auction.ended',
        jc.encode({
          id: '64f1a2b3c4d5e6f7a8b9c0d2',
          sellerId: testUserId,
          title: 'Test Auction',
        }),
      );

      const res = await waitForNotification(testUserId);

      if (res.body.errors) {
        console.error(
          'Auction Ended GraphQL Errors:',
          JSON.stringify(res.body.errors, null, 2),
        );
      }
      const items = res.body.data?.getUserNotifications?.items || [];
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].type).toBe('AUCTION_WON');
    }, 30000);
  });

  describe('GraphQL Security & Authorization', () => {
    const otherUserId = '64f1a2b3c4d5e6f7a8b9c0d9';

    it('should prevent user from seeing another user notifications', async () => {
      // Seed notification for otherUserId
      const natsClient = context.getNatsClient();
      natsClient.publish(
        'bid.created',
        jc.encode({
          auction_id: '64f1a2b3c4d5e6f7a8b9c0d2',
          user_id: otherUserId,
          amount: 100,
        }),
      );
      await waitForNotification(otherUserId);

      // Try to retrieve as testUserId
      const res = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${generateTestToken(testUserId)}`)
        .send({ query: '{ getUserNotifications { items { id } } }' });

      // Should be empty for testUserId
      expect(res.body.data.getUserNotifications.items.length).toBe(0);
    }, 30000);

    it('should reject unauthorized requests with 401/error', async () => {
      const res = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .send({ query: '{ getUserNotifications { items { id } } }' });

      expect(res.body.errors).toBeDefined();
      expect(res.body.data?.getUserNotifications).toBeFalsy();
    });
  });

  describe('Pagination & Filters', () => {
    it('should correctly paginate notifications', async () => {
      // Ensure DB is clean before seeding
      await cleanDatabase(app);

      const natsClient = context.getNatsClient();
      // Seed 3 notifications
      for (let i = 1; i <= 3; i++) {
        natsClient.publish(
          'bid.created',
          jc.encode({
            auction_id: '64f1a2b3c4d5e6f7a8b9c0d2',
            user_id: testUserId,
            amount: 100 * i,
          }),
        );
      }
      // Wait for NATS to process all 3
      await waitForNotification(testUserId, 3);

      const paginatedQuery = `
                query GetPaginated($pagination: PaginationInput!) {
                    getUserNotifications(pagination: $pagination) {
                        items { id }
                    }
                }
            `;

      const res = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${generateTestToken(testUserId)}`)
        .send({
          query: paginatedQuery,
          variables: { pagination: { page: 1, limit: 2 } },
        });

      console.log('Pagination Response:', JSON.stringify(res.body, null, 2));

      if (res.body.errors) {
        console.error(
          'Pagination GraphQL Errors:',
          JSON.stringify(res.body.errors, null, 2),
        );
      }

      expect(res.body.data?.getUserNotifications?.items?.length).toBe(2);
    }, 15000);

    it('should mark a notification as read', async () => {
      const natsClient = context.getNatsClient();
      natsClient.publish(
        'bid.created',
        jc.encode({
          auction_id: '64f1a2b3c4d5e6f7a8b9c0d2',
          user_id: testUserId,
          amount: 100,
        }),
      );
      await waitForNotification(testUserId);

      let res = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${generateTestToken(testUserId)}`)
        .send({ query: '{ getUserNotifications { items { id isRead } } }' });

      console.log(
        'Mark Read Seed Response:',
        JSON.stringify(res.body, null, 2),
      );
      const items = res.body.data?.getUserNotifications?.items || [];
      expect(items.length).toBeGreaterThan(0);
      const notificationId = items[0].id;
      expect(items[0].isRead).toBe(false);

      const mutation = `
                mutation MarkRead($id: String!) {
                    markNotificationAsRead(id: $id) {
                        data { isRead }
                    }
                }
            `;

      res = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${generateTestToken(testUserId)}`)
        .send({ query: mutation, variables: { id: notificationId } });

      expect(res.body.data.markNotificationAsRead.data.isRead).toBe(true);
    }, 20000);

    it('should delete a notification', async () => {
      const natsClient = context.getNatsClient();
      natsClient.publish(
        'bid.created',
        jc.encode({
          auction_id: '64f1a2b3c4d5e6f7a8b9c0d2',
          user_id: testUserId,
          amount: 100,
        }),
      );
      await waitForNotification(testUserId);

      let res = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${generateTestToken(testUserId)}`)
        .send({ query: '{ getUserNotifications { items { id } } }' });

      console.log('Delete Seed Response:', JSON.stringify(res.body, null, 2));
      const items = res.body.data?.getUserNotifications?.items || [];
      expect(items.length).toBeGreaterThan(0);
      const notificationId = items[0].id;

      const mutation = `
                mutation Delete($id: String!) {
                    deleteNotification(id: $id) {
                        message
                    }
                }
            `;

      res = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${generateTestToken(testUserId)}`)
        .send({ query: mutation, variables: { id: notificationId } });

      expect(res.body.data.deleteNotification.message).toBeDefined();

      res = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${generateTestToken(testUserId)}`)
        .send({ query: '{ getUserNotifications { items { id } } }' });

      expect(res.body.data.getUserNotifications.items.length).toBe(0);
    }, 20000);
  });

  describe('AI Message Chunk Streaming (Subscription)', () => {
    it('should receive AI message chunks via subscription', (done) => {
      const httpServer = app.getHttpServer();
      const address = httpServer.address();
      const currentPort = typeof address === 'string' ? address : address?.port;

      console.log(`Testing Subscription on Port: ${currentPort}`);

      const client = createClient({
        url: `ws://127.0.0.1:${currentPort}/graphql`,
        connectionParams: {
          authorization: `Bearer ${testToken}`,
        },
        webSocketImpl: WebSocket,
        retryAttempts: 0, // No retry to avoid hanging after teardown
      });
      const aiSubQuery = `
                subscription {
                    aiMessageChunk {
                        chunk
                        isFinal
                    }
                }
            `;

      const unsubscribe = client.subscribe(
        { query: aiSubQuery },
        {
          next: (data: any) => {
            console.log('Received AI chunk data:', data);
            const chunk = data.data.aiMessageChunk;
            expect(chunk.chunk).toBe('Hello world');
            unsubscribe();
            client.dispose();
            done();
          },
          error: (err) => {
            console.error('Subscription error:', err);
            client.dispose();
            done(err);
          },
          complete: () => {
            console.log('Subscription complete');
            client.dispose();
          },
        },
      );

      // Give it 2 seconds to establish connection before publishing
      setTimeout(() => {
        console.log('Publishing AI message chunk...');
        const natsClient = context.getNatsClient();
        natsClient.publish(
          'ai.message.chunk',
          jc.encode({
            userId: testUserId,
            threadId: 'thread-1',
            chunk: 'Hello world',
            isFinal: true,
          }),
        );
      }, 3000);
    }, 30000);
  });

  function generateTestToken(userId: string) {
    const payload = {
      id: userId,
      email: 'test@example.com',
      role: 'admin',
      permissions: [
        'read_notification',
        'update_notification',
        'delete_notification',
      ],
    };
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `${header}.${body}.signature`;
  }
});
