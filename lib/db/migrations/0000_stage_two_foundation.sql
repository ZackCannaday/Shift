BEGIN;

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "website" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone,
  "login_token" text,
  "login_token_expiry" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "visitors" (
  "id" serial PRIMARY KEY NOT NULL,
  "api_key_id" integer REFERENCES "api_keys"("id"),
  "session_id" text NOT NULL,
  "referrer" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "user_agent" text,
  "device_type" text,
  "intent_signals" text,
  "persona" text DEFAULT 'unknown' NOT NULL,
  "persona_confidence" real,
  "headline" text,
  "subheadline" text,
  "cta_text" text,
  "converted" boolean DEFAULT false NOT NULL,
  "conversion_event" text,
  "time_on_site" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "ai_provider" text DEFAULT 'rules' NOT NULL;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "ai_model" text;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "ai_api_key_encrypted" text;

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "email_verified_at" timestamp with time zone,
  "login_token" text,
  "login_token_expiry" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_login_token_unique" ON "users" ("login_token");

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "organization_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text DEFAULT 'owner' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_org_user_unique"
  ON "organization_members" ("organization_id", "user_id");

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "organization_id" integer;

DO $$
DECLARE
  site RECORD;
  migrated_user_id integer;
  migrated_org_id integer;
BEGIN
  FOR site IN SELECT * FROM "api_keys" WHERE "organization_id" IS NULL LOOP
    INSERT INTO "users" ("email", "name", "email_verified_at", "login_token", "login_token_expiry")
      VALUES (lower(trim(site.email)), site.name, now(), site.login_token, site.login_token_expiry)
      ON CONFLICT ("email") DO NOTHING;
    SELECT "id" INTO migrated_user_id FROM "users" WHERE "email" = lower(trim(site.email));

    INSERT INTO "organizations" ("name") VALUES (site.name) RETURNING "id" INTO migrated_org_id;
    INSERT INTO "organization_members" ("organization_id", "user_id", "role")
      VALUES (migrated_org_id, migrated_user_id, 'owner')
      ON CONFLICT ("organization_id", "user_id") DO NOTHING;
    UPDATE "api_keys" SET "organization_id" = migrated_org_id WHERE "id" = site.id;
  END LOOP;
END $$;

ALTER TABLE "api_keys" ALTER COLUMN "organization_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "api_keys_organization_idx" ON "api_keys" ("organization_id");
DROP INDEX IF EXISTS "api_keys_email_unique";

CREATE TABLE IF NOT EXISTS "dashboard_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer,
  "api_key_id" integer NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "dashboard_sessions" ADD COLUMN IF NOT EXISTS "user_id" integer;
UPDATE "dashboard_sessions" AS sessions
SET "user_id" = users.id
FROM "api_keys" AS sites
JOIN "users" AS users ON users.email = lower(trim(sites.email))
WHERE sessions.api_key_id = sites.id AND sessions.user_id IS NULL;
ALTER TABLE "dashboard_sessions" ALTER COLUMN "user_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "dashboard_sessions" ADD CONSTRAINT "dashboard_sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "dashboard_sessions" ADD CONSTRAINT "dashboard_sessions_api_key_id_api_keys_id_fk"
    FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_sessions_token_hash_unique" ON "dashboard_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "dashboard_sessions_api_key_idx" ON "dashboard_sessions" ("api_key_id");
CREATE INDEX IF NOT EXISTS "dashboard_sessions_user_idx" ON "dashboard_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "dashboard_sessions_expiry_idx" ON "dashboard_sessions" ("expires_at");

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "bucket_key" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "rate_limit_buckets_pk" PRIMARY KEY ("bucket_key", "window_start")
);

ALTER TABLE "visitors" DROP CONSTRAINT IF EXISTS "visitors_session_id_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "visitors_site_session_unique" ON "visitors" ("api_key_id", "session_id");
CREATE INDEX IF NOT EXISTS "visitors_site_created_idx" ON "visitors" ("api_key_id", "created_at");
CREATE INDEX IF NOT EXISTS "visitors_site_persona_idx" ON "visitors" ("api_key_id", "persona");

ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "login_token";
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "login_token_expiry";

COMMIT;
