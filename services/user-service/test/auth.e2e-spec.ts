import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getApp } from './utils/e2e-setup';
import { cleanDatabase } from './utils/database-cleaner';
import { DataSource } from 'typeorm';

describe('AuthResolver (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const graphqlEndpoint = '/user/graphql';

  beforeAll(async () => {
    app = getApp();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await cleanDatabase(dataSource);
  });

  describe('register (Mutation)', () => {
    it('should successfully register a new user', async () => {
      const registerMutation = `
        mutation Register($input: CreateUserDto!) {
          register(createUserDto: $input) {
            success
            message
            statusCode
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .send({
          query: registerMutation,
          variables: {
            input: {
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com',
              password: 'Password123!',
              country: 'EG',
            },
          },
        });

      // Assert GraphQL no-errors
      expect(response.body.errors).toBeUndefined();

      const { register } = response.body.data;
      expect(register.success).toBe(true);
      expect(register.statusCode).toBe(201);
      expect(register.message).toBeDefined();

      // Verify the data in the database
      const usersCount = await dataSource.query(
        `SELECT COUNT(*) FROM "users";`,
      );
      expect(parseInt(usersCount[0].count, 10)).toBe(1);
    });

    it('should fail if email is already taken', async () => {
      const registerMutation = `
        mutation Register($input: CreateUserDto!) {
          register(createUserDto: $input) {
            success
            message
            statusCode
          }
        }
      `;

      const input = {
        firstName: 'Test2',
        lastName: 'User2',
        email: 'duplicate@example.com',
        password: 'Password123!',
        country: 'EG',
      };

      const registerResponse1 = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .send({ query: registerMutation, variables: { input } });

      expect(registerResponse1.body.errors).toBeUndefined();

      const response = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .send({ query: registerMutation, variables: { input } });

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('login (Mutation)', () => {
    it('should login and return tokens for valid credentials', async () => {
      const registerMutation = `
        mutation Register($input: CreateUserDto!) {
          register(createUserDto: $input) { 
            success 
            data { user { id } }
          }
        }
      `;
      await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .send({
          query: registerMutation,
          variables: {
            input: {
              firstName: 'Login',
              lastName: 'Test',
              email: 'login@example.com',
              password: 'Password123!',
              country: 'EG',
            },
          },
        });

      const loginMutation = `
        mutation Login($input: LoginDto!) {
          login(loginDto: $input) {
            success
            statusCode
            data {
              token
            }
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .send({
          query: loginMutation,
          variables: {
            input: {
              email: 'login@example.com',
              password: 'Password123!',
            },
          },
        });

      expect(response.body.errors).toBeUndefined();
      const { login } = response.body.data;
      expect(login.success).toBe(true);
      expect(login.statusCode).toBe(200);
      expect(login.data).toBeDefined();
      expect(login.data.token).toBeDefined();
    });
  });
});
