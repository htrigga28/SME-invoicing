import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly database?: AppDatabase;
  private readonly pool?: Pool;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const databaseUrl = configService.get<string>("DATABASE_URL");

    if (!databaseUrl) {
      return;
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      // Keep an established Neon connection available between requests. The
      // default ten-second idle timeout makes the next request pay the full
      // cross-region TLS/connect latency again.
      idleTimeoutMillis: 300_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true
    });
    this.database = drizzle(this.pool, { schema });
  }

  async onModuleInit() {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.query("select 1");
    } catch (error) {
      // Do not prevent the API from starting when Neon is temporarily
      // unavailable. The first request will surface the database error.
      this.logger.warn(`Database connection warm-up failed: ${String(error)}`);
    }
  }

  get db(): AppDatabase {
    if (!this.database) {
      throw new Error("DATABASE_URL is required for database-backed API operations.");
    }

    return this.database;
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
