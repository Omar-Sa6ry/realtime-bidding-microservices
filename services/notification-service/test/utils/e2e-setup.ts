import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { connect, NatsConnection, JSONCodec } from 'nats';
import { MongoDBContainer } from '@testcontainers/mongodb';
import { RedisContainer } from '@testcontainers/redis';
import { GenericContainer, Wait } from 'testcontainers';

export const jc = JSONCodec();

export class E2ETestContext {
    private mongodbContainer: any;
    private redisContainer: any;
    private natsContainer: any;
    private app: INestApplication;
    private natsClient: NatsConnection;

    async bootstrap() {
        try {
            
            console.log('Starting MongoDB container...');
            this.mongodbContainer = await new MongoDBContainer('mongo:6.0')
                .withStartupTimeout(300000)
                .start();

            console.log('Starting Redis container...');
            this.redisContainer = await new RedisContainer('redis:alpine')
                .withStartupTimeout(300000)
                .start();

            console.log('Starting NATS container (Generic)...');
            this.natsContainer = await new GenericContainer('nats:2.10-alpine')
                .withExposedPorts(4222)
                .withWaitStrategy(Wait.forLogMessage(/Server is ready/))
                .withStartupTimeout(300000)
                .start();

            const natsHost = '127.0.0.1';
            const natsPort = this.natsContainer.getMappedPort(4222);
            const natsUrl = `nats://${natsHost}:${natsPort}`;
            process.env.NATS_URL = natsUrl;
            
            const redisHost = '127.0.0.1';
            const redisPort = this.redisContainer.getMappedPort(6379);
            process.env.REDIS_HOST = redisHost;
            process.env.REDIS_PORT = redisPort.toString();
            process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`;

            let mongoUri = this.mongodbContainer.getConnectionString().replace('localhost', '127.0.0.1');
            if (!mongoUri.includes('directConnection')) {
                mongoUri += (mongoUri.includes('?') ? '&' : '?') + 'directConnection=true';
            }
            process.env.MONGO_URI = mongoUri;

            delete process.env.NATS_USER;
            delete process.env.NATS_PASSWORD;
            delete process.env.NATS_TOKEN;

            console.log(`Infrastructure Ready. NATS: ${natsUrl}, MONGO: ${mongoUri}, REDIS: ${process.env.REDIS_URL}`);

            try {
                const tempClient = await connect({ 
                    servers: natsUrl, 
                    timeout: 5000,
                    user: undefined,
                    pass: undefined,
                    token: undefined
                } as any);
                await tempClient.close();
            } catch (err) {
                console.error('NATS Early Connectivity Check FAILED:', err);
                throw err;
            }

            // Require App Modules AFTER environment is set
            const { AppModule } = require('../../src/app.module');
            const { NotificationSubModule } = require('../../src/modules/notification/notification.module');
            const { PubSubModule } = require('../../src/modules/pubsub/pubsub.module');
            const { TranslationModule } = require('../../src/common/translation/translation.module');
            const { ConfigModule } = require('@nestjs/config');
            const { MongooseModule } = require('@nestjs/mongoose');
            const { UserService } = require('../../src/modules/user/user.service');
            const { EmailAdapter } = require('../../src/modules/notification/adapters/email.adapter');
            const { UserClientAdapter } = require('../../src/modules/notification/adapters/user-client.adapter');
            const { AuctionClientAdapter } = require('../../src/modules/notification/adapters/auction-client.adapter');
            const { Transport } = require('@nestjs/microservices');

            const moduleFixture: TestingModule = await Test.createTestingModule({
                imports: [AppModule],
            })
            .overrideProvider(EmailAdapter).useValue({ sendEmail: jest.fn() })
            .overrideProvider(UserService).useValue({ 
                findById: jest.fn().mockImplementation((id) => Promise.resolve({ 
                    id, 
                    email: 'test-e2e@example.com',
                    role: 'admin'
                })) 
            })
            .overrideProvider(UserClientAdapter).useValue({ 
                getUserByUserId: jest.fn().mockImplementation((id) => Promise.resolve({ 
                    id, 
                    email: 'test-e2e@example.com',
                    firstName: 'Test',
                    lastName: 'User'
                })) 
            })
            .overrideProvider(AuctionClientAdapter).useValue({ 
                getAuction: jest.fn().mockResolvedValue({ 
                    id: '64f1a2b3c4d5e6f7a8b9c0d2', 
                    title: 'Test Luxury Watch' 
                }) 
            })
            .overrideProvider(JwtService).useValue({
                verifyAsync: jest.fn().mockImplementation((token) => {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
                    return Promise.resolve(payload);
                })
            })
            .compile();

            this.app = moduleFixture.createNestApplication();
            this.app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

            // Add JWT parsing middleware to populate req.user for RoleGuard
            this.app.use((req: any, res: any, next: any) => {
                const authHeader = req.headers.authorization;
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    const token = authHeader.split(' ')[1];
                    try {
                        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
                        req.user = payload;
                    } catch (e) {
                        console.error('Middleware JWT parse error:', e.message);
                    }
                }
                next();
            });

            this.app.connectMicroservice({
                transport: Transport.NATS,
                options: {
                    servers: [natsUrl],
                    waitOnFirstConnect: true,
                    reconnectTimeWait: 2000,
                    maxReconnectAttempts: 10,
                    ignoreClusterUpdates: true,
                    user: undefined,
                    pass: undefined,
                    token: undefined
                },
            } as any);

            console.log('Initializing Application...');
            await this.app.init();
            
            console.log('Starting HTTP Server...');
            await this.app.listen(0);
            
            console.log('Starting Microservices...');
            await this.app.startAllMicroservices();
            
            console.log('Connecting NATS test client...');
            this.natsClient = await connect({ 
                servers: natsUrl, 
                timeout: 20000, // 20s for Windows
                maxReconnectAttempts: 10,
                reconnectTimeWait: 2000,
                waitOnFirstConnect: true,
                ignoreClusterUpdates: true
            });

            // Verify connectivity
            try {
                await this.natsClient.flush();
                console.log('NATS Ping SUCCESS');
            } catch (err) {
                console.error('NATS Ping FAILED:', err);
                throw err;
            }
            
            console.log('--- E2ETestContext.bootstrap() SUCCESS ---\n');
            return this;
        } catch (error) {
            console.error('\n!!! E2ETestContext.bootstrap() FAILED !!!');
            console.error(error);
            throw error;
        }
    }

    async shutdown() {
        if (!this.app) return;
        
        console.log('\nShutting down E2E Infrastructure...');
        
        try {
            const pubSub = this.app.get('PUB_SUB', { strict: false });
            if (pubSub && typeof pubSub.close === 'function') {
                console.log('Closing PubSub connection...');
                await pubSub.close();
            }
        } catch (e) {
            console.log('Could not close PubSub:', e.message);
        }

        if (this.natsClient) {
            try { await this.natsClient.close(); } catch (e) {}
        }

        try {
            await this.app.close();
        } catch (e) {
            console.log('Error closing app:', e.message);
        }

        if (this.mongodbContainer) {
            try { await this.mongodbContainer.stop(); } catch (e) {}
        }
        if (this.redisContainer) {
            try { await this.redisContainer.stop(); } catch (e) {}
        }
        if (this.natsContainer) {
            try { await this.natsContainer.stop(); } catch (e) {}
        }
    }

    getApp(): INestApplication { return this.app; }
    getNatsClient(): NatsConnection { return this.natsClient; }
    getPort(): number { return this.app.getHttpServer()?.address()?.port || 0; }
}




