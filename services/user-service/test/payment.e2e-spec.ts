import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getApp } from './utils/e2e-setup';
import { cleanDatabase } from './utils/database-cleaner';
import { DataSource } from 'typeorm';

describe('PaymentResolver (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const graphqlEndpoint = '/user/graphql';
  let jwtToken: string;

  beforeAll(async () => {
    app = getApp();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await cleanDatabase(dataSource);
  });

  const registerAndLogin = async () => {
    const registerMutation = `
      mutation Register($input: CreateUserDto!) {
        register(createUserDto: $input) { success }
      }
    `;
    const registerResponse = await request(app.getHttpServer()).post(graphqlEndpoint).send({
      query: registerMutation,
      variables: {
        input: {
          firstName: 'Payment',
          lastName: 'Test',
          email: 'payment@example.com',
          password: 'Password123!',
          country: 'EG',
        },
      },
    });

    expect(registerResponse.body.errors).toBeUndefined();

    const loginMutation = `
      mutation Login($input: LoginDto!) {
        login(loginDto: $input) {
          success
          data { token }
        }
      }
    `;
    const loginResponse = await request(app.getHttpServer()).post(graphqlEndpoint).send({
      query: loginMutation,
      variables: {
        input: { email: 'payment@example.com', password: 'Password123!' },
      },
    });

    expect(loginResponse.body.errors).toBeUndefined();

    jwtToken = loginResponse.body.data.login.data.token;
  };

  describe('rechargeWallet (Mutation)', () => {
    it('should generate a payment checkout URL', async () => {
      await registerAndLogin();

      const rechargeWalletMutation = `
        mutation RechargeWallet($amount: Float!) {
          rechargeWallet(amount: $amount) {
            data
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          query: rechargeWalletMutation,
          variables: { amount: 100 },
        });

      expect(response.body.errors).toBeUndefined();
      const checkoutUrl = response.body.data.rechargeWallet.data;

      expect(checkoutUrl).toBeDefined();
      expect(typeof checkoutUrl).toBe('string');
    });

    it('should fail if user is unauthenticated', async () => {
      const rechargeWalletMutation = `
        mutation RechargeWallet($amount: Float!) {
          rechargeWallet(amount: $amount) {
            data
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .send({
          query: rechargeWalletMutation,
          variables: { amount: 100 },
        });

      expect(response.body.errors).toBeDefined();
    });
  });
});
