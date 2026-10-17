-- CreateTable
CREATE TABLE "auths" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "roles" TEXT[] DEFAULT ARRAY['user']::TEXT[],
    "refresh_token_hash" TEXT,
    "google_id" TEXT,
    "apple_id" TEXT,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "auths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "auth_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastname" TEXT,
    "age" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_codes" (
    "code_hash" TEXT NOT NULL,
    "auth_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("code_hash")
);

-- CreateIndex
-- Hand-edited: these four are PARTIAL unique indexes (live rows only), which Prisma cannot express. Unique only among
-- rows that are not soft-deleted, so a deleted user's email / provider id / profile slot can be reused. The schema
-- declares them as plain @@unique under the same names; keep the names in step.
CREATE UNIQUE INDEX "uq_auths_email_live" ON "auths"("email") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_auths_google_live" ON "auths"("google_id") WHERE "deleted_at" IS NULL AND "google_id" IS NOT NULL;

CREATE UNIQUE INDEX "uq_auths_apple_live" ON "auths"("apple_id") WHERE "deleted_at" IS NULL AND "apple_id" IS NOT NULL;

CREATE UNIQUE INDEX "uq_profiles_auth_live" ON "profiles"("auth_id") WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX "idx_login_codes_expires_at" ON "login_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
