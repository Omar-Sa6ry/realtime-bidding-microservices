import * as net from 'net';

async function inspectNats(host: string, port: number) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection({ host, port }, () => {
            console.log(`Connected to NATS at ${host}:${port}`);
        });

        client.on('data', (data) => {
            console.log('Received from NATS:', data.toString());
            client.end();
            resolve(data.toString());
        });

        client.on('error', (err) => {
            console.error('Connection error:', err);
            reject(err);
        });

        setTimeout(() => {
            client.end();
            reject(new Error('Timeout waiting for NATS INFO'));
        }, 5000);
    });
}
