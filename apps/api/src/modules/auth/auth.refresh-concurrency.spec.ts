import { ConfigService } from "@nestjs/config";
import { and, eq, isNull } from "drizzle-orm";

import { DatabaseService, type AppDatabase } from "../../database/database.service";
import { refreshTokens, users } from "../../database/schema";
import {
  requiredRow,
  startApiTestPool,
  uniqueSlug,
  type ApiTestPool
} from "../../test/postgres-test-helper";
import { TenantContextService } from "../tenant/tenant-context.service";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

jest.setTimeout(180000);

let pool: ApiTestPool;
let db: AppDatabase;
let databaseService: () => DatabaseService;

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class RotationBarrier {
  private arrivals = 0;
  private readonly bothArrived = createDeferred<void>();
  private readonly releaseRotation = createDeferred<void>();

  async waitAtRotationBoundary() {
    this.arrivals += 1;
    if (this.arrivals === 2) {
      this.bothArrived.resolve();
    }

    await this.releaseRotation.promise;
  }

  waitForBothRequests() {
    return this.bothArrived.promise;
  }

  release() {
    this.releaseRotation.resolve();
  }
}

class BarrierAuthRepository extends AuthRepository {
  constructor(
    databaseService: DatabaseService,
    private readonly barrier: RotationBarrier
  ) {
    super(databaseService);
  }

  override async rotateRefreshToken(
    oldRefreshTokenId: string,
    userId: string,
    newTokenHash: string,
    newTokenExpiresAt: Date
  ) {
    await this.barrier.waitAtRotationBoundary();
    return super.rotateRefreshToken(oldRefreshTokenId, userId, newTokenHash, newTokenExpiresAt);
  }
}

function tokenService() {
  return new TokenService({
    getOrThrow: (key: string) => `${key}-test-secret-that-is-long-enough`
  } as unknown as ConfigService);
}

function authService(repository: AuthRepository) {
  return new AuthService(
    repository,
    {} as PasswordService,
    tokenService(),
    {} as TenantContextService
  );
}

beforeAll(async () => {
  pool = await startApiTestPool();
  db = pool.db;
  databaseService = pool.databaseService;
});

afterAll(async () => {
  await pool.stop();
});

describe("refresh rotation (real Postgres)", () => {
  it("creates one replacement when two database connections submit the same token", async () => {
    const slug = uniqueSlug("refresh-race");
    const user = requiredRow(
      await db
        .insert(users)
        .values({ email: `${slug}@example.com`, name: "Refresh User", passwordHash: "x" })
        .returning(),
      "user"
    );
    const initialToken = "initial-refresh-token-for-concurrent-rotation";
    const hashingService = tokenService();
    const parent = requiredRow(
      await db
        .insert(refreshTokens)
        .values({
          userId: user.id,
          tokenHash: hashingService.hashRefreshToken(initialToken),
          expiresAt: hashingService.getRefreshTokenExpiry()
        })
        .returning(),
      "parent refresh token"
    );
    const barrier = new RotationBarrier();
    const first = authService(new BarrierAuthRepository(databaseService(), barrier));
    const second = authService(new BarrierAuthRepository(databaseService(), barrier));

    const firstRequest = first.refresh({ refreshToken: initialToken });
    const secondRequest = second.refresh({ refreshToken: initialToken });

    // Named barrier: both services have read the same active parent through
    // independent PostgreSQL pools before either can execute the CAS update.
    await barrier.waitForBothRequests();
    barrier.release();

    const results = await Promise.allSettled([firstRequest, secondRequest]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const rows = await db
      .select({ id: refreshTokens.id, revokedAt: refreshTokens.revokedAt })
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, user.id));
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === parent.id)?.revokedAt).not.toBeNull();
    const active = await db
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
    expect(active).toHaveLength(1);
  });
});
