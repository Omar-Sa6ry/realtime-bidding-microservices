import 'reflect-metadata';
const request = require('supertest');
import { E2ETestContext, jc } from './utils/e2e-setup';
import { waitFor } from './utils/test-helpers';

import { INestApplication } from '@nestjs/common';

describe('AI Service (e2e)', () => {
  let context: E2ETestContext;
  let app: INestApplication;
  const graphqlEndpoint = '/graphql';
  const testUserId = '64f1a2b3c4d5e6f7a8b9c0d1';
  let testToken: string;

  // Increase timeout for long-running E2E operations
  jest.setTimeout(180000);

  beforeAll(async () => {
    context = new E2ETestContext();
    await context.bootstrap();
    app = context.getApp();
    testToken = generateTestToken(testUserId);
  }, 600000);

  afterAll(async () => {
    await context.shutdown();
  }, 120000);

  function generateTestToken(userId: string) {
    const payload = {
      id: userId,
      userId: userId,
      email: 'test@example.com',
      role: 'admin',
      permissions: ['send_message', 'view_chat_threads', 'view_chat_history'],
    };
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `${header}.${body}.signature`;
  }

  async function gqlRequest(
    query: string,
    variables: any = {},
    token?: string,
  ) {
    const req = request(app.getHttpServer()).post(graphqlEndpoint);
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req.send({ query, variables });
    if (res.status !== 200 || res.body.errors) {
      // Log full body for debugging non-expected failures
      if (
        !query.includes('auction-invalid') &&
        !query.includes('unauthorized')
      ) {
        console.error(
          `GQL FAIL [${res.status}]:`,
          JSON.stringify(res.body, null, 2),
        );
      }
    }
    return res;
  }

  it('should complete a full chat workflow', async () => {
    const auctionId = `auc-${Date.now()}`;

    const sendRes = await gqlRequest(
      `
            mutation SendMsg($input: SendMessageInput!) {
                sendMessage(input: $input) {
                    success
                    data { threadId }
                }
            }
        `,
      { input: { auctionId, text: 'Hello AI workflow' } },
      testToken,
    );

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.data?.sendMessage?.success).toBe(true);
    const threadId = sendRes.body.data.sendMessage.data.threadId;

    const listRes = await gqlRequest(
      `
            query {
                getUserChatThreads {
                    success
                    items { auctionId userId title }
                }
            }
        `,
      {},
      testToken,
    );

    expect(listRes.status).toBe(200);
    expect(listRes.body.data?.getUserChatThreads?.success).toBe(true);

    const threads = listRes.body.data.getUserChatThreads.items || [];
    expect(threads.some((t: any) => t.auctionId === auctionId)).toBe(true);

    // 3. Verify Message History (Polling for DB consistency)
    let historyRes: any;
    await waitFor(
      async () => {
        historyRes = await gqlRequest(
          `
                query GetHistory($tid: String!) {
                    getChatMessages(threadId: $tid) {
                        success
                        items { role content }
                    }
                }
            `,
          { tid: threadId },
          testToken,
        );
        return historyRes.body.data?.getChatMessages?.items?.length > 0;
      },
      15000,
      1000,
    );

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data?.getChatMessages?.success).toBe(true);
    expect(historyRes.body.data.getChatMessages.items.length).toBeGreaterThan(
      0,
    );
  });

  it('should emit chunks via NATS when streaming', async () => {
    const natsClient = context.getNatsClient();
    const chunks: any[] = [];
    const subject = 'ai.message.chunk';
    const sub = natsClient.subscribe(subject);

    const subDone = (async () => {
      for await (const m of sub) {
        chunks.push(jc.decode(m.data));
        if (chunks.length >= 1) break;
      }
    })();

    const res = await gqlRequest(
      `
            mutation {
                sendMessage(input: { auctionId: "auction-nats", text: "Stream me" }) { success }
            }
        `,
      {},
      testToken,
    );

    expect(res.status).toBe(200);
    expect(res.body.data?.sendMessage?.success).toBe(true);

    await Promise.race([
      subDone,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('NATS stream timeout')), 10000),
      ),
    ]);

    expect(chunks.length).toBeGreaterThan(0);
    sub.unsubscribe();
  });

  describe('Security & Validation', () => {
    it('should return errors for unauthorized request', async () => {
      const res = await gqlRequest(`query { getUserChatThreads { success } }`);
      expect(res.body.errors).toBeDefined();
    });

    it('should return error for invalid input', async () => {
      const res = await gqlRequest(
        `
                mutation SendErr($input: SendMessageInput!) {
                    sendMessage(input: $input) {
                        success
                    }
                }
            `,
        { input: { auctionId: 'auction-invalid', text: '' } },
        testToken,
      );

      expect(
        res.body.errors || res.body.data?.sendMessage?.success === false,
      ).toBeTruthy();
    });
  });
});
