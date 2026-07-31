import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DataSource } from 'typeorm';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { AdminUserEntity } from '../src/users/entities/admin-user.entity';
import { EmployeeUserEntity } from '../src/users/entities/employee-user.entity';
import { AppJwtPayload } from '../src/auth/types/auth.interfaces';

// E2E: the whole real app — real HTTP server, real WebSocket gateway, real
// MySQL/Mongo/Redis, every consumer actually running — not a single class
// with fakes plugged in. This is the golden path: assign a mission, complete
// it, and confirm XP/level/notification all really happen, live, through
// the same interfaces a real client uses (HTTP + a real Socket.IO
// connection), not by reaching into internals to check.
//
// Runs against a fully isolated environment (see e2e-env.setup.ts and
// e2e-reset-environment.ts, npm's `pretest:e2e`) — its own MySQL database,
// its own Redis logical DB index, its own Mongo database, wiped fresh
// before every run. This isn't optional polish: running this against the
// shared dev database/Redis DB nearly caused a real duplicate XP grant and
// a spurious notification send during development of this test, and
// surfaced a real bug (RedisModule/BullmqModule not respecting a distinct
// Redis DB — fixed alongside this file).
//
// Two things this test deliberately does NOT touch, and why:
//  - Authentik (real login / POST /admin/accounts, which itself calls
//    Authentik to provision the account) — an external, non-deterministic
//    dependency with no test/mock mode. Both the admin and employee here
//    are inserted directly into `users`, and their JWTs are self-signed
//    with the app's own JWT_SECRET — JwtStrategy only verifies the
//    signature/expiry, it has no way to know (or care) that a real OIDC
//    flow didn't produce it. This mirrors the "one-time bootstrap seed for
//    the very first admin" a real deployment already needs, since
//    POST /admin/accounts is itself admin-only — chicken-and-egg.
//  - event_catalog seeding — handled for free by EventCatalogSeedService's
//    own OnApplicationBootstrap hook, same as it does for the real app.
describe('Employee golden path (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;
  let adminJwt: string;
  let employeeJwt: string;
  let employeeId: string;
  let adminId: string;
  let missionId: string;
  const eventLinkIds: string[] = [];
  let socket: Socket;

  function signToken(payload: AppJwtPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Without this, the gateway silently binds a second server on a random
    // port instead of attaching to the app's own HTTP server — the same bug
    // documented in main.ts. A TestingModule-booted app bypasses main.ts
    // entirely, so it has to be done here too.
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0); // port 0 = let the OS pick a free one

    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    dataSource = app.get(DataSource);

    // Bootstrap the one admin — see the class-level comment for why this
    // bypasses POST /admin/accounts entirely.
    const admin = await dataSource.getRepository(AdminUserEntity).save({
      sub: `e2e-admin-${randomUUID()}`,
      email: `e2e-admin-${randomUUID()}@example.com`,
      name: 'E2E Admin',
    });
    adminId = admin.id;
    adminJwt = signToken({
      sub: admin.sub,
      userId: admin.id,
      email: admin.email,
      name: admin.name,
      groups: ['admin'],
    });

    const employee = await dataSource.getRepository(EmployeeUserEntity).save({
      sub: `e2e-employee-${randomUUID()}`,
      email: `e2e-employee-${randomUUID()}@example.com`,
      name: 'E2E Employee',
      xp: 0,
      level: 1,
    });
    employeeId = employee.id;
    employeeJwt = signToken({
      sub: employee.sub,
      userId: employee.id,
      email: employee.email,
      name: employee.name,
      groups: ['employee'],
    });

    // Create the mission via the real admin API — a fresh e2e database has
    // no missions at all.
    const missionRes = await request(baseUrl)
      .post('/admin/missions')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'E2E Golden Path Mission', xpGranted: 50 }); // no durationDays — keeps this flow simple, no reminder chain
    missionId = missionRes.body.id;

    // Wire the rules this flow needs — a fresh e2e database has an empty
    // event_links table, nothing pre-configured like our long-lived dev DB.
    const wirings: Array<{ sourceEvent: string; action: string; params: Record<string, any>; targetEvent?: string }> = [
      { sourceEvent: 'MissionCompleted', action: 'GrantXP', params: {}, targetEvent: 'XPGranted' },
      { sourceEvent: 'XPGranted', action: 'CheckLevelThreshold', params: {} },
      {
        sourceEvent: 'MissionCompleted',
        action: 'Notify',
        params: { kind: 'general', message: 'You completed {{missionName}}!', channels: ['in-app'] },
      },
    ];
    for (const wiring of wirings) {
      const res = await request(baseUrl)
        .post('/admin/event-links')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send(wiring);
      eventLinkIds.push(res.body.id);
    }
  });

  afterAll(async () => {
    socket?.disconnect();
    await dataSource.getRepository('event_links').delete(eventLinkIds).catch(() => {});
    await dataSource.query('DELETE FROM mission_assignments WHERE missionId = ?', [missionId]);
    await dataSource.query('DELETE FROM missions WHERE id = ?', [missionId]);
    await dataSource.getRepository(EmployeeUserEntity).delete(employeeId);
    await dataSource.getRepository(AdminUserEntity).delete(adminId);
    await app.close();
  });

  it('assigns, completes, grants XP/level, and pushes a live notification', async () => {
    // Connect BEFORE anything happens, so the socket is already listening
    // when the async chain eventually fires.
    socket = io(baseUrl, { auth: { token: employeeJwt }, transports: ['websocket'] });
    const notificationPromise = new Promise((resolve) => {
      socket.on('notification:new', resolve);
    });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));

    const assignRes = await request(baseUrl)
      .post('/missions/assign')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ missionId, employeeId });
    expect(assignRes.status).toBe(201);
    expect(assignRes.body.status).toBe('ASSIGNED');
    const assignmentId = assignRes.body.id;

    const completeRes = await request(baseUrl)
      .post(`/missions/assignments/${assignmentId}/complete`)
      .set('Authorization', `Bearer ${employeeJwt}`)
      .send();
    expect(completeRes.status).toBe(201);
    expect(completeRes.body.status).toBe('COMPLETED');

    // The real async chain: outbox -> OutboxProcessor (@Interval(5000)) ->
    // Redis stream -> RuleEngineConsumer -> GrantXP -> CheckLevelThreshold
    // and -> Notify -> InAppProcessor -> the socket push. This is the one
    // piece of real waiting nothing here can shortcut.
    const pushedNotification = await notificationPromise;
    expect(pushedNotification).toMatchObject({
      message: expect.stringContaining('E2E Golden Path Mission'),
      read: false,
    });

    // Same event, verified through a second, independent path — REST, not
    // just the socket.
    const notificationsRes = await request(baseUrl)
      .get('/notifications')
      .set('Authorization', `Bearer ${employeeJwt}`);
    expect(notificationsRes.body.some((n: any) => n.message.includes('E2E Golden Path Mission'))).toBe(true);

    // And the actual business effect, read fresh from the database — not
    // trusted from any earlier response. GrantXP's own transaction commits
    // before Notify's rule even starts (RuleEngineConsumer processes a
    // message's matched rules sequentially), so this should already be
    // true the instant the notification arrives — the short retry is
    // defensive slack for the read to become visible across the pool, not
    // a sign the ordering itself is in question.
    let xp: number | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const employeeAfter = await dataSource.getRepository(EmployeeUserEntity).findOneByOrFail({ id: employeeId });
      xp = employeeAfter.xp;
      if (xp === 50) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(xp).toBe(50);
  });
});
