import 'dotenv/config';
import mysql from 'mysql2/promise';
import Redis from 'ioredis';

const MYSQL_E2E_DATABASE = 'gamitool_notif_hub_e2e';
const REDIS_E2E_DB = 1;

// Run once before the e2e suite (npm's `pretest:e2e` convention — see
// package.json). Drops and recreates the dedicated e2e MySQL database from
// scratch (AppModule's own `synchronize: true` then builds the full schema
// fresh on first boot, same as it does for the real dev database) and
// flushes the dedicated Redis logical DB. Safe to be this destructive
// specifically because both are dedicated to e2e — never the real dev
// database or the real Redis DB index 0.
async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    // No `database` here — dropping/creating a database requires connecting
    // without one selected.
  });
  await connection.query(`DROP DATABASE IF EXISTS \`${MYSQL_E2E_DATABASE}\``);
  await connection.query(`CREATE DATABASE \`${MYSQL_E2E_DATABASE}\``);
  await connection.end();
  console.log(`[e2e-reset] MySQL database "${MYSQL_E2E_DATABASE}" recreated`);

  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    db: REDIS_E2E_DB,
  });
  await redis.flushdb();
  redis.disconnect();
  console.log(`[e2e-reset] Redis DB ${REDIS_E2E_DB} flushed`);
}

main().catch((error) => {
  console.error('[e2e-reset] failed:', error);
  process.exit(1);
});
