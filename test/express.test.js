const request = require('supertest');
const app = require('../expressServer');

describe('Express server', () => {
    test('GET /ping returns pong with status 201', async () => {
        const res = await request(app).get('/ping');
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ message: 'pong' });
    });

    test('POST /api/wikitext parses wikitext into text', async () => {
        const res = await request(app)
            .post('/api/wikitext')
            .send({ wikitext: 'hello [[World]]' });
        expect(res.status).toBe(201);
        expect(typeof res.body.text).toBe('string');
        expect(res.body.text).toContain('World');
    });

    test('POST /api/wikitext without body does not crash', async () => {
        const res = await request(app).post('/api/wikitext').send({});
        expect(res.status).toBe(201);
        expect(typeof res.body.text).toBe('string');
    });
});
