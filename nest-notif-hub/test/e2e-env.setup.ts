// Runs as a Jest `setupFiles` entry — same process as the test file, before
// it's imported, so these overrides are in place before `app.module.ts`
// (which reads MONGO_URI at decorator-evaluation time) or RedisModule (which
// reads REDIS_DB) ever get evaluated. Listed AFTER "dotenv/config" in
// jest-e2e.json so the real .env loads first and these three values win.
//
// The point: e2e tests get their own MySQL database, their own Redis
// logical DB index, and their own Mongo database — a completely separate
// keyspace from the real dev environment, on the same servers. Nothing here
// can collide with real dev data or a concurrently-running dev app, and
// nothing here needs per-test cleanup logic to stay safe — see
// test/e2e-reset-environment.ts, which wipes all three completely fresh
// before the suite runs.
process.env.MYSQL_DATABASE = 'gamitool_notif_hub_e2e';
process.env.REDIS_DB = '1';
process.env.MONGO_URI = 'mongodb://localhost:27017/gamitool_notif_hub_e2e';
