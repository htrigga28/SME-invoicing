import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly database?: AppDatabase;
  private readonly pool?: Pool;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const databaseUrl = configService.get<string>("DATABASE_URL");

    if (!databaseUrl) {
      return;
    }

    this.pool = new Pool({ connectionString: databaseUrl });
    this.database = drizzle(this.pool, { schema });
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
