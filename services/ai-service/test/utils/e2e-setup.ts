import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { connect, NatsConnection, JSONCodec } from 'nats';
import { MongoDBContainer } from '@testcontainers/mongodb';
import { RedisContainer } from '@testcontainers/redis';
import { GenericContainer, Wait } from 'testcontainers';
import { Transport } from '@nestjs/microservices';

export const jc = JSONCodec();

export class E2ETestContext {
    private mongodbContainer: any;
    private redisContainer: any;
    private natsContainer: any;
    private app: INestApplication;
    private natsClient: NatsConnection;

    async bootstrap() {
        try {
            console.log('Starting infrastructure containers sequentially...');
            
            console.log('Starting MongoDB container...');
            this.mongodbContainer = await new MongoDBContainer('mongo:6.0')
                .withStartupTimeout(300000)
                .start();

            console.log('Starting Redis container...');
            this.redisContainer = await new RedisContainer('redis:alpine')
                .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
                .withStartupTimeout(300000)
                .start();

            console.log('Starting NATS container...');
            this.natsContainer = await new GenericContainer('nats:2.10-alpine')
                .withExposedPorts(4222)
                .withWaitStrategy(Wait.forLogMessage(/Server is ready/))
                .withStartupTimeout(300000)
                .start();

            const natsHost = this.natsContainer.getHost().replace('localhost', '127.0.0.1');
            const natsPort = this.natsContainer.getMappedPort(4222);
            const natsUrl = `nats://${natsHost}:${natsPort}`;
            process.env.NATS_URL = natsUrl;
            
            const redisHost = this.redisContainer.getHost().replace('localhost', '127.0.0.1');
            const redisPort = this.redisContainer.getMappedPort(6379);
            process.env.REDIS_HOST = redisHost;
            process.env.REDIS_PORT = redisPort.toString();
            process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`;
            process.env.REDIS_PASSWORD = '';

            let mongoUri = this.mongodbContainer.getConnectionString().replace('localhost', '127.0.0.1');
            if (!mongoUri.includes('directConnection')) {
                mongoUri += (mongoUri.includes('?') ? '&' : '?') + 'directConnection=true';
            }
            process.env.MONGO_URI = mongoUri;

            console.log(`Infrastructure Ready. NATS: ${natsUrl}, MONGO: ${mongoUri}, REDIS: ${process.env.REDIS_URL}`);
            
            // Wait for networking bridge stability on Windows
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Verify NATS connectivity early
            try {
                const tempClient = await connect({ servers: natsUrl, timeout: 20000 });
                await tempClient.close();
                console.log('NATS Early Connectivity Check: PASSED');
            } catch (err) {
                console.error('NATS Early Connectivity Check: FAILED', err.message);
            }

            // Require App Modules AFTER environment is set
            const { AppModule } = require('../../src/app.module');
            const { GqlThrottlerGuard } = require('../../src/common/guards/gql-throttler.guard');
            const { GeminiProviderAdapter } = require('../../src/modules/gemini/providers/gemini-provider.adapter');
            const { UserService } = require('../../src/modules/user/user.service');
            const { ContextService } = require('../../src/modules/grpc/context.service');
            const { JwtService } = require('@nestjs/jwt');
            const { RoleGuard } = require('@bidding-micro/shared');

            const moduleFixture: TestingModule = await Test.createTestingModule({
                imports: [AppModule],
            })
            .overrideProvider(JwtService).useValue({
                verifyAsync: jest.fn().mockImplementation((token) => {
                    try {
                        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
                        return Promise.resolve(payload);
                    } catch (e) {
                        return Promise.reject(new Error('Invalid token'));
                    }
                })
            })
            .overrideGuard(RoleGuard).useValue({ canActivate: () => true })
            .overrideGuard(GqlThrottlerGuard).useValue({ canActivate: () => Promise.resolve(true) })
            .overrideProvider(GeminiProviderAdapter).useValue({
                onModuleInit: jest.fn(),
                sendMessageStream: jest.fn().mockImplementation(async function* () {
                    yield 'Hello';
                    yield ' ';
                    yield 'from';
                    yield ' ';
                    yield 'AI';
                })
            })
            .overrideProvider(UserService).useValue({ 
                onModuleInit: jest.fn(),
                findById: jest.fn().mockImplementation((id) => Promise.resolve({ 
                    id, 
                    email: 'test-e2e@example.com',
                    role: 'admin'
                })) 
            })
            .overrideProvider(ContextService).useValue({
                onModuleInit: jest.fn(),
                getAiContext: jest.fn().mockResolvedValue({
                    auction: { id: 'auction-1', title: 'Test Auction' },
                    userBids: [],
                    user: { id: 'user-1', email: 'test@example.com' }
                })
            })
            .overrideProvider('GRPC_USER_SERVICE').useValue({
                getService: () => ({
                    getUser: jest.fn().mockReturnValue({ subscribe: (cb: any) => cb({ user: { id: '1' } }) })
                })
            })
            .overrideProvider('GRPC_AUCTION_SERVICE').useValue({
                getService: () => ({
                    getAuction: jest.fn().mockReturnValue({ subscribe: (cb: any) => cb({ auction: { id: '1' } }) })
                })
            })
            .overrideProvider('GRPC_BIDDING_SERVICE').useValue({
                getService: () => ({
                    getUserBids: jest.fn().mockReturnValue({ subscribe: (cb: any) => cb({ bids: [] }) })
                })
            })
            .compile();

            this.app = moduleFixture.createNestApplication();
            this.app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

            // JWT parsing middleware for RoleGuard
            this.app.use((req: any, res: any, next: any) => {
                const authHeader = req.headers.authorization;
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    const token = authHeader.split(' ')[1];
                    try {
                        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
                        req.user = {
                            ...payload,
                            id: payload.id || payload.userId,
                            userId: payload.userId || payload.id
                        };
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
                },
            });

            console.log('Initializing Application...');
            await this.app.init();
            
            console.log('Starting HTTP Server...');
            await this.app.listen(0);
            
            console.log('Starting Microservices...');
            await this.app.startAllMicroservices();
            
            console.log('Connecting NATS test client...');
            this.natsClient = await connect({ 
                servers: natsUrl,
                waitOnFirstConnect: true,
                timeout: 20000 
            });

            console.log('--- E2ETestContext.bootstrap() SUCCESS ---\n');
            return this;
        } catch (error) {
            console.error('\n!!! E2ETestContext.bootstrap() FAILED !!!');
            console.error(error);
            throw error;
        }
    }

    async shutdown() {
        console.log('\nShutting down E2E Infrastructure...');
        
        if (this.app) {
            try {
                const pubSub = this.app.get('PUB_SUB', { strict: false });
                if (pubSub && typeof pubSub.close === 'function') {
                    console.log('Closing PubSub connection...');
                    await pubSub.close();
                }
            } catch (e) {
                console.log('PubSub cleanup skipped:', e.message);
            }
        }

        if (this.natsClient) {
            try { 
                await this.natsClient.flush(2000);
                await this.natsClient.close(); 
            } catch (e) {}
        }

        if (this.app) {
            try { await this.app.close(); } catch (e) {}
        }

        if (this.mongodbContainer) {
            try { await this.mongodbContainer.stop({ timeout: 5000 }); } catch (e) {}
        }
        if (this.redisContainer) {
            try { await this.redisContainer.stop({ timeout: 5000 }); } catch (e) {}
        }
        if (this.natsContainer) {
            try { await this.natsContainer.stop({ timeout: 5000 }); } catch (e) {}
        }
        console.log('Shutdown complete.\n');
    }

    getApp(): INestApplication { return this.app; }
    getNatsClient(): NatsConnection { return this.natsClient; }
    getPort(): number { return this.app.getHttpServer()?.address()?.port || 0; }
}

