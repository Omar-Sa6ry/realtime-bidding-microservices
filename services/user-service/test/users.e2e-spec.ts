import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getApp } from './utils/e2e-setup';
import { cleanDatabase } from './utils/database-cleaner';
import { DataSource } from 'typeorm';

describe('UserResolver (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const graphqlEndpoint = '/user/graphql';
  let jwtToken: string;
  let userId: string;

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
          firstName: 'Ahmed',
          lastName: 'Sabry',
          email: 'AhmedSabry@example.com',
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
          data { 
            token 
            user { id }
          }
        }
      }
    `;
    const loginResponse = await request(app.getHttpServer()).post(graphqlEndpoint).send({
      query: loginMutation,
      variables: {
        input: {
          email: 'AhmedSabry@example.com',
          password: 'Password123!',
        },
      },
    });

    expect(loginResponse.body.errors).toBeUndefined();

    jwtToken = loginResponse.body.data.login.data.token;
    userId = loginResponse.body.data.login.data.user?.id;
    if (!userId) {
      const users = await dataSource.query(`SELECT id FROM "users" LIMIT 1;`);
      userId = users[0].id;
    }
  };

  describe('getUserByOfMe (Query)', () => {
    it('should get current user profile when authenticated', async () => {
      await registerAndLogin();

      const getMeQuery = `
        query {
          getUserByOfMe {
            data {
              firstName
              lastName
              email
            }
            statusCode
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ query: getMeQuery });

      expect(response.body.errors).toBeUndefined();
      const userRes = response.body.data.getUserByOfMe;
      expect(userRes.statusCode).toBe(200);
      expect(userRes.data.email).toBe('AhmedSabry@example.com');
    });

    it('should throw error if not authenticated', async () => {
      const getMeQuery = `
        query {
          getUserByOfMe {
            statusCode
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .send({ query: getMeQuery });

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('getUserById (Query)', () => {
    it('should get user by id successfully', async () => {
      await registerAndLogin();

      const getUserByIdQuery = `
        query GetUserById($id: UserIdInput!) {
          getUserById(id: $id) {
            data {
              firstName
              email
            }
            statusCode
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          query: getUserByIdQuery,
          variables: {
            id: { UserId: userId }
          }
        });

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.getUserById.data.firstName).toBe('Ahmed');
    });
  });

  describe('updateProfile (Mutation)', () => {
    it('should successfully update current user profile', async () => {
      await registerAndLogin();

      const updateProfileMutation = `
        mutation UpdateProfile($input: UpdateUserDto!) {
          updateProfile(updateUserDto: $input) {
            data { firstName lastName }
            statusCode
            success
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          query: updateProfileMutation,
          variables: {
            input: {
              id: userId,
              firstName: 'Omar', 
              lastName: 'Sabry Updated'
            }
          }
        });

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.updateProfile.success).toBe(true);
      expect(response.body.data.updateProfile.data.firstName).toBe('Omar');
    });
  });
});
