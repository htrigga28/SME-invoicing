import "dotenv/config";

import { createHmac } from "crypto";
import * as argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  businessProfiles,
  organisationInvitations,
  organisationMembers,
  organisations,
  users
} from "./schema";

const demoPassword = "DemoPass123!";
const organisationSlug = "akin-co-demo";
const organisationName = "Akin & Co Creative Services";
const frontendUrl = (process.env.FRONTEND_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const demoUsers = [
  { email: "owner@demo.com", name: "Demo Owner", role: "owner" },
  { email: "admin@demo.com", name: "Demo Admin", role: "admin" },
  { email: "accountant@demo.com", name: "Demo Accountant", role: "accountant" },
  { email: "viewer@demo.com", name: "Demo Viewer", role: "viewer" }
] as const;

const demoInvitations = [
  {
    email: "pending.accountant@demo.com",
    role: "accountant",
    status: "pending",
    token: "dev-pending-accountant-demo-token",
    daysFromNow: 7
  },
  {
    email: "pending.viewer@demo.com",
    role: "viewer",
    status: "pending",
    token: "dev-pending-viewer-demo-token",
    daysFromNow: 7
  },
  {
    email: "expired.viewer@demo.com",
    role: "viewer",
    status: "expired",
    token: "dev-expired-viewer-demo-token",
    daysFromNow: -1
  },
  {
    email: "revoked.accountant@demo.com",
    role: "accountant",
    status: "revoked",
    token: "dev-revoked-accountant-demo-token",
    daysFromNow: 7
  }
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the development seed.");
  }

  if (!refreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is required to hash development invitation tokens.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const now = new Date();
  const passwordHash = await argon2.hash(demoPassword);

  try {
    const [organisation] = await db
      .insert(organisations)
      .values({
        name: organisationName,
        slug: organisationSlug,
        onboardingCompletedAt: now
      })
      .onConflictDoUpdate({
        target: organisations.slug,
        set: {
          name: organisationName,
          onboardingCompletedAt: now,
          updatedAt: now
        }
      })
      .returning();

    if (!organisation) {
      throw new Error("Demo organisation could not be created.");
    }

    await db
      .insert(businessProfiles)
      .values({
        organisationId: organisation.id,
        businessName: organisationName,
        email: "billing@akinco.test",
        phone: "+2348012345678",
        address: "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
        setupCompletedAt: now
      })
      .onConflictDoUpdate({
        target: businessProfiles.organisationId,
        set: {
          businessName: organisationName,
          email: "billing@akinco.test",
          phone: "+2348012345678",
          address: "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
          setupCompletedAt: now,
          updatedAt: now
        }
      });

    const seededUsers = new Map<string, { id: string }>();

    for (const demoUser of demoUsers) {
      const [user] = await db
        .insert(users)
        .values({
          email: demoUser.email,
          name: demoUser.name,
          passwordHash
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: demoUser.name,
            passwordHash,
            updatedAt: now
          }
        })
        .returning();

      if (!user) {
        throw new Error(`Demo user could not be created: ${demoUser.email}`);
      }

      seededUsers.set(demoUser.email, { id: user.id });

      const [existingMembership] = await db
        .select()
        .from(organisationMembers)
        .where(
          and(
            eq(organisationMembers.organisationId, organisation.id),
            eq(organisationMembers.userId, user.id)
          )
        )
        .limit(1);

      if (existingMembership) {
        await db
          .update(organisationMembers)
          .set({
            role: demoUser.role,
            status: "active",
            updatedAt: now
          })
          .where(eq(organisationMembers.id, existingMembership.id));
      } else {
        await db.insert(organisationMembers).values({
          organisationId: organisation.id,
          userId: user.id,
          role: demoUser.role,
          status: "active"
        });
      }
    }

    const owner = seededUsers.get("owner@demo.com");

    if (!owner) {
      throw new Error("Demo owner was not seeded.");
    }

    const pendingInviteUrls: string[] = [];

    for (const invitation of demoInvitations) {
      const tokenHash = createHmac("sha256", refreshSecret).update(invitation.token).digest("hex");
      const expiresAt = new Date(now.getTime() + invitation.daysFromNow * 24 * 60 * 60 * 1000);
      const revokedAt = invitation.status === "revoked" ? now : null;

      const [existingInvitation] = await db
        .select()
        .from(organisationInvitations)
        .where(
          and(
            eq(organisationInvitations.organisationId, organisation.id),
            eq(organisationInvitations.email, invitation.email),
            eq(organisationInvitations.status, invitation.status)
          )
        )
        .limit(1);

      if (existingInvitation) {
        await db
          .update(organisationInvitations)
          .set({
            tokenHash,
            role: invitation.role,
            invitedByUserId: owner.id,
            expiresAt,
            revokedAt,
            updatedAt: now
          })
          .where(eq(organisationInvitations.id, existingInvitation.id));
      } else {
        await db.insert(organisationInvitations).values({
          organisationId: organisation.id,
          email: invitation.email,
          tokenHash,
          role: invitation.role,
          status: invitation.status,
          invitedByUserId: owner.id,
          expiresAt,
          revokedAt
        });
      }

      if (invitation.status === "pending") {
        pendingInviteUrls.push(`${frontendUrl}/accept-invite/${invitation.token}`);
      }
    }

    console.log("Development seed complete.");
    console.log(`Demo organisation: ${organisationName}`);
    console.log("Demo password for all seeded users: DemoPass123!");
    console.log(
      "Dev-only pending invite URLs. Raw tokens are printed here only and are not stored:"
    );
    for (const inviteUrl of pendingInviteUrls) {
      console.log(`- ${inviteUrl}`);
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
