const path = require('path');
const { spawn } = require('child_process');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.resolve(__dirname, '../protos/wikiTextParser.proto');
const PORT = 30199;
const HOST = '127.0.0.1';
const ADDRESS = `${HOST}:${PORT}`;
const ROOT = path.resolve(__dirname, '..');

function loadClient() {
    const packageDefinition = protoLoader.loadSync(
        PROTO_PATH,
        { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
    );
    const proto = grpc.loadPackageDefinition(packageDefinition).wikiTextParser;
    return new proto.WikiTextParserService(ADDRESS, grpc.credentials.createInsecure());
}

let client;
let serverProc;

beforeAll((done) => {
    serverProc = spawn(
        process.execPath,
        ['grpcServer.js', '--port', String(PORT), '--host', HOST, '--worker', 'full'],
        { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let settled = false;
    let startTimeout;
    const finish = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(startTimeout);
        done(err);
    };

    const onData = (chunk) => {
        if (chunk.toString().includes('Server bound to')) {
            try {
                client = loadClient();
                finish();
            } catch (e) {
                finish(e);
            }
        }
    };
    serverProc.stdout.on('data', onData);
    serverProc.stderr.on('data', onData);
    serverProc.on('error', (e) => finish(e));
    startTimeout = setTimeout(() => finish(new Error('gRPC server did not start in time')), 15000);
}, 20000);

afterAll((done) => {
    if (client) {
        try { grpc.closeClient(client); } catch (e) { /* ignore */ }
    }
    if (!serverProc) return done();
    let settled = false;
    let killTimeout;
    const finish = () => {
        if (!settled) {
            settled = true;
            clearTimeout(killTimeout);
            done();
        }
    };
    serverProc.on('exit', finish);
    serverProc.kill('SIGTERM');
    killTimeout = setTimeout(() => {
        try { serverProc.kill('SIGKILL'); } catch (e) { /* ignore */ }
        finish();
    }, 3000);
});

test('GetWikiTextParse returns parsed wikitext', (done) => {
    client.GetWikiTextParse({ text: '[[Apple]] is a [[Category:Fruit]] fruit.' }, (err, response) => {
        expect(err).toBeFalsy();
        expect(response).toHaveProperty('text');
        const parsed = JSON.parse(response.text);
        expect(parsed.categories).toContain('Fruit');
        expect(parsed.links.internal).toContainEqual({ page: 'Apple' });
        done();
    });
}, 10000);

test('GetWikiTextParse returns INVALID_ARGUMENT for empty text', (done) => {
    client.GetWikiTextParse({ text: '' }, (err) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe(grpc.status.INVALID_ARGUMENT);
        done();
    });
}, 10000);

test('GetWikiTextParse handles wikitext with percentage template (no crash)', (done) => {
    client.GetWikiTextParse({ text: '{{percentage|1|2|decimals=200}}' }, (err, response) => {
        expect(err).toBeFalsy();
        expect(response).toHaveProperty('text');
        expect(() => JSON.parse(response.text)).not.toThrow();
        done();
    });
}, 10000);
