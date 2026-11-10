import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { statSync } from 'fs';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Video streaming (e2e)', () => {
	let app: INestApplication;
	const size = statSync('assets/1.mp4').size;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();
		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(() => app.close());

	it('streams the requested byte range', async () => {
		const res = await request(app.getHttpServer())
			.get('/video/stream/1')
			.set('Range', 'bytes=0-99')
			.expect(206);
		expect(res.headers['content-range']).toBe(`bytes 0-99/${size}`);
		expect(res.headers['content-length']).toBe('100');
	});

	it('clamps an end past the file to its last byte', async () => {
		const res = await request(app.getHttpServer())
			.get('/video/stream/1')
			.set('Range', `bytes=${size - 10}-${size + 1000}`)
			.expect(206);
		expect(res.headers['content-range']).toBe(
			`bytes ${size - 10}-${size - 1}/${size}`
		);
	});

	it('answers 416 for a range outside the file', () =>
		request(app.getHttpServer())
			.get('/video/stream/1')
			.set('Range', `bytes=${size}-`)
			.expect(416)
			.expect('Content-Range', `bytes */${size}`));

	it('answers 404 for a missing video or a path outside assets/', async () => {
		await request(app.getHttpServer()).get('/video/stream/999').expect(404);
		await request(app.getHttpServer())
			.get('/video/stream/..%2Fpackage')
			.expect(404);
	});
});
