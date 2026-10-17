import 'reflect-metadata';
import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL ??= 'postgresql://nestjs_user:nestjs_password@localhost:5432/nestjs_postgres';
	process.env.JWT_SECRET = 'a'.repeat(32);
	process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
	process.env.METRICS_TOKEN = 'metrics-token-1234';
});

import { AppModule } from '../../src/app.module';
import { AuthUser } from '../../src/domain/auth-user';
import { AUTH_REPOSITORY, IAuthRepository, IUnitOfWork, UNIT_OF_WORK } from '../../src/domain/repositories';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

const PASSWORD = 'Sup3r-Secret!pw';
const NEW_PASSWORD = 'An0ther-Secret!pw';
const WRONG_PASSWORD = 'Wrong-Passw0rd!';

let app: INestApplication;
let db: PrismaService;
let seq = 0;

const http = () => request(app.getHttpServer());
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function register(overrides: Record<string, unknown> = {}) {
	const body = { email: `user${++seq}@example.com`, password: PASSWORD, name: 'Test User', ...overrides };
	const res = await http().post('/api/auth/register').send(body);
	return { body, res, tokens: res.body as { accessToken: string; refreshToken: string } };
}

async function makeAdmin(email: string) {
	await db.$executeRawUnsafe("UPDATE auths SET roles = ARRAY['admin'] WHERE email = $1", email);
}

async function login(email: string, password = PASSWORD) {
	return http().post('/api/auth/login').send({ email, password });
}

beforeAll(async () => {
	const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
		// Registration is rate limited to 5/min; the tests register more users than that.
		.overrideProvider(ThrottlerStorage)
		.useValue({
			increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
		})
		.compile();
	app = moduleRef.createNestApplication();
	app.setGlobalPrefix('api', {
		exclude: [
			{ path: 'health', method: RequestMethod.GET },
			{ path: 'metrics', method: RequestMethod.GET },
		],
	});
	app.useLogger(false);
	await app.init();
	db = app.get(PrismaService);
});

beforeEach(async () => {
	await db.$executeRawUnsafe('TRUNCATE TABLE login_codes, profiles, auths CASCADE');
});

afterAll(async () => {
	await app?.close();
});

describe('health', () => {
	it('reports database up without auth', async () => {
		const res = await http().get('/health');
		expect(res.status).toBe(200);
		expect(res.body.status).toBe('ok');
	});
});

describe('metrics', () => {
	it('requires the bearer token', async () => {
		expect((await http().get('/metrics')).status).toBe(401);
		expect((await http().get('/metrics').set(bearer('wrong'))).status).toBe(401);
	});

	it('exposes request durations labelled by route pattern, not raw URL', async () => {
		await http().get('/api/profiles/me'); // 401, still observed
		await http().get('/api/does-not-exist/12345');

		const res = await http().get('/metrics').set(bearer('metrics-token-1234'));
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toContain('text/plain');
		expect(res.text).toContain('process_cpu_user_seconds_total');
		expect(res.text).toMatch(/http_request_duration_seconds_count\{method="GET",route="\/api\/profiles\/me",status_code="401"\} 1/);
		expect(res.text).toContain('route="unmatched"');
		expect(res.text).not.toContain('12345');
		expect(res.text).not.toContain('route="/metrics"');
	});
});

describe('request id', () => {
	it('generates one and echoes a safe caller-supplied one', async () => {
		const generated = await http().get('/api/profiles/me');
		expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

		const echoed = await http().get('/api/profiles/me').set('X-Request-Id', 'trace-123');
		expect(echoed.headers['x-request-id']).toBe('trace-123');

		const unsafe = await http().get('/api/profiles/me').set('X-Request-Id', 'bad id	with spaces');
		expect(unsafe.headers['x-request-id']).not.toContain(' ');
	});
});

describe('auth', () => {
	it('registers, returns tokens, and creates a profile', async () => {
		const { res, tokens } = await register({ name: 'Ada', lastname: 'Lovelace', age: 36 });
		expect(res.status).toBe(201);
		expect(tokens.accessToken).toBeTruthy();
		expect(tokens.refreshToken).toBeTruthy();

		const me = await http().get('/api/profiles/me').set(bearer(tokens.accessToken));
		expect(me.status).toBe(200);
		expect(me.body).toMatchObject({ name: 'Ada', lastname: 'Lovelace', age: 36 });
	});

	it('rejects invalid registration bodies with the violations listed', async () => {
		const res = await http().post('/api/auth/register').send({ email: 'nope', password: 'weak', name: 'A' });
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.errors).toBeDefined();
	});

	it('rejects a duplicate email with 409', async () => {
		const { body } = await register();
		const res = await http().post('/api/auth/register').send(body);
		expect(res.status).toBe(409);
	});

	it('logs in with correct credentials and rejects wrong ones', async () => {
		const { body } = await register();
		expect((await login(body.email as string)).status).toBe(200);
		expect((await login(body.email as string, WRONG_PASSWORD)).status).toBe(401);
		expect((await login('missing@example.com')).status).toBe(401);
	});

	it('requires a token on protected routes', async () => {
		expect((await http().get('/api/profiles/me')).status).toBe(401);
		expect((await http().get('/api/profiles/me').set(bearer('garbage'))).status).toBe(401);
	});

	it('rotates refresh tokens and rejects reuse of the old one', async () => {
		const { tokens } = await register();
		const first = await http().post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken });
		expect(first.status).toBe(200);
		expect(first.body.refreshToken).not.toBe(tokens.refreshToken);

		const reuse = await http().post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken });
		expect(reuse.status).toBe(401);
	});

	it('invalidates the refresh token on logout', async () => {
		const { tokens } = await register();
		const out = await http().post('/api/auth/logout').set(bearer(tokens.accessToken));
		expect(out.status).toBe(204);
		const res = await http().post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken });
		expect(res.status).toBe(401);
	});

	it('changes the password', async () => {
		const { body, tokens } = await register();
		const wrongOld = await http()
			.post('/api/auth/change-password')
			.set(bearer(tokens.accessToken))
			.send({ oldPassword: WRONG_PASSWORD, newPassword: NEW_PASSWORD });
		expect(wrongOld.status).toBe(401);

		const changed = await http()
			.post('/api/auth/change-password')
			.set(bearer(tokens.accessToken))
			.send({ oldPassword: PASSWORD, newPassword: NEW_PASSWORD });
		expect(changed.status).toBe(204);

		expect((await login(body.email as string)).status).toBe(401);
		expect((await login(body.email as string, NEW_PASSWORD)).status).toBe(200);
	});
});

describe('profiles', () => {
	it('updates the current profile', async () => {
		const { tokens } = await register();
		const res = await http().patch('/api/profiles/me').set(bearer(tokens.accessToken)).send({ name: 'Renamed' });
		expect(res.status).toBe(200);
		expect(res.body.name).toBe('Renamed');
	});

	it('forbids listing for non-admins', async () => {
		const { tokens } = await register();
		const res = await http().get('/api/profiles').set(bearer(tokens.accessToken));
		expect(res.status).toBe(403);
	});

	describe('admin list (query engine)', () => {
		let adminToken: string;

		beforeEach(async () => {
			await register({ name: 'Alice', age: 20 });
			await register({ name: 'Bob', age: 30 });
			await register({ name: 'Bobby', age: 40 });
			const admin = await register({ name: 'Admin', age: 50 });
			await makeAdmin(admin.body.email as string);
			// Roles are stored in the DB, so log in again to get a token carrying the admin role.
			adminToken = (await login(admin.body.email as string)).body.accessToken;
		});

		it('filters, sorts and pages', async () => {
			const res = await http()
				.get('/api/profiles')
				.query({ 'filter[name][contains]': 'bo', sort: '-age', 'page[number]': 1, 'page[size]': 1 })
				.set(bearer(adminToken));
			expect(res.status).toBe(200);
			expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(['Bobby']);
		});

		it('filters numerically', async () => {
			const res = await http()
				.get('/api/profiles')
				.query({ 'filter[age][gte]': 30, sort: 'age' })
				.set(bearer(adminToken));
			expect(res.status).toBe(200);
			expect(res.body.items.map((p: { age: number }) => p.age)).toEqual([30, 40, 50]);
		});

		it('rejects unknown filters and sort fields with 400', async () => {
			const res = await http()
				.get('/api/profiles')
				.query({ 'filter[password][equals]': 'x', sort: 'secret' })
				.set(bearer(adminToken));
			expect(res.status).toBe(400);
		});
	});
});

describe('database behaviour', () => {
	it('a soft-deleted user is invisible and their email can be registered again', async () => {
		const { body, tokens } = await register();
		const auth = app.get<IAuthRepository>(AUTH_REPOSITORY);
		const user = await auth.findByEmail(body.email as string);
		expect(user).not.toBeNull();

		await auth.softDelete(user!.id);
		expect(await auth.findByEmail(body.email as string)).toBeNull();
		expect(await auth.findById(user!.id)).toBeNull();
		expect((await login(body.email as string)).status).toBe(401);
		// The row is kept, only marked.
		expect(await db.$queryRawUnsafe('SELECT 1 FROM auths WHERE deleted_at IS NOT NULL')).toHaveLength(1);
		expect(tokens.accessToken).toBeTruthy();

		// Partial unique index: the deleted row no longer blocks the email.
		const again = await http().post('/api/auth/register').send(body);
		expect(again.status).toBe(201);
		expect(await db.$queryRawUnsafe('SELECT 1 FROM auths')).toHaveLength(2);
	});

	it('two simultaneous sign-ups with one email produce exactly one account and one 409', async () => {
		const body = { email: 'race@example.com', password: PASSWORD, name: 'Racer' };
		const results = await Promise.all(Array.from({ length: 6 }, () => http().post('/api/auth/register').send(body)));

		expect(results.filter((r) => r.status === 201)).toHaveLength(1);
		expect(results.filter((r) => r.status === 409)).toHaveLength(5);
		expect(await db.$queryRawUnsafe('SELECT 1 FROM auths')).toHaveLength(1);
		expect(await db.$queryRawUnsafe('SELECT 1 FROM profiles')).toHaveLength(1);
	});

	it('rolls back the auth row when the profile insert fails inside the transaction', async () => {
		const uow = app.get<IUnitOfWork>(UNIT_OF_WORK);
		const auth = app.get<IAuthRepository>(AUTH_REPOSITORY);
		const created = AuthUser.create({ email: 'rollback@example.com', passwordHash: 'x' }).getRight();

		await expect(
			uow.run(async ({ auth: a }) => {
				await a.save(created);
				throw new Error('boom');
			}),
		).rejects.toThrow('boom');
		expect(await auth.findByEmail('rollback@example.com')).toBeNull();
	});
});

describe('profile list filters', () => {
	let adminToken: string;

	beforeEach(async () => {
		await register({ name: 'Alice', lastname: 'Smith', age: 20 });
		await register({ name: '100%', age: 30 });
		await register({ name: 'Bob_by', age: 40 });
		const admin = await register({ name: 'Admin', age: 50 });
		await makeAdmin(admin.body.email as string);
		adminToken = (await login(admin.body.email as string)).body.accessToken;
	});

	const list = (query: Record<string, string | number>) => http().get('/api/profiles').query(query).set(bearer(adminToken));
	const names = (res: request.Response) => res.body.items.map((p: { name: string }) => p.name).sort();

	it('treats % and _ in a contains filter literally', async () => {
		expect(names(await list({ 'filter[name][contains]': '%' }))).toEqual(['100%']);
		expect(names(await list({ 'filter[name][contains]': '_' }))).toEqual(['Bob_by']);
	});

	it('matches case-insensitively', async () => {
		expect(names(await list({ 'filter[name][contains]': 'ALICE' }))).toEqual(['Alice']);
	});

	it('filters by creation date and ignores an unparseable date instead of failing', async () => {
		const future = await list({ 'filter[createdAt][gte]': '2999-01-01' });
		expect(future.status).toBe(200);
		expect(future.body.items).toHaveLength(0);

		const past = await list({ 'filter[createdAt][gte]': '2000-01-01' });
		expect(past.body.items).toHaveLength(4);
	});

	it('reports the total across pages and pages through sorted results', async () => {
		const first = await list({ 'filter[age][gte]': 30, sort: 'age', 'page[number]': 1, 'page[size]': 2 });
		expect(first.body.total).toBe(3);
		expect(first.body.items.map((p: { age: number }) => p.age)).toEqual([30, 40]);
		const second = await list({ 'filter[age][gte]': 30, sort: 'age', 'page[number]': 2, 'page[size]': 2 });
		expect(second.body.items.map((p: { age: number }) => p.age)).toEqual([50]);
	});

	it('combines filters on different fields', async () => {
		const res = await list({ 'filter[age][gte]': 30, 'filter[name][contains]': 'b' });
		expect(names(res)).toEqual(['Bob_by']);
	});

	it('does not list soft-deleted profiles', async () => {
		await db.$executeRawUnsafe("UPDATE profiles SET deleted_at = now() WHERE name = 'Alice'");
		const res = await list({});
		expect(names(res)).not.toContain('Alice');
		expect(res.body.total).toBe(3);
	});
});
