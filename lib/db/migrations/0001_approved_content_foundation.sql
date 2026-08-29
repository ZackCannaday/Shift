BEGIN;

DO $$ BEGIN
  CREATE TYPE "content_target_type" AS ENUM ('headline', 'subheadline', 'cta');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "content_variant_status" AS ENUM ('draft', 'approved', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "content_targets" (
  "id" serial PRIMARY KEY NOT NULL,
  "api_key_id" integer NOT NULL,
  "target_key" text NOT NULL,
  "target_type" "content_target_type" NOT NULL,
  "name" text NOT NULL,
  "page_path" text DEFAULT '*' NOT NULL,
  "selector" text NOT NULL,
  "fallback_content" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "updated_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_targets_key_format_check" CHECK ("target_key" ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT "content_targets_name_length_check" CHECK (char_length("name") BETWEEN 1 AND 120),
  CONSTRAINT "content_targets_path_length_check" CHECK (char_length("page_path") BETWEEN 1 AND 500),
  CONSTRAINT "content_targets_selector_length_check" CHECK (char_length("selector") BETWEEN 1 AND 500),
  CONSTRAINT "content_targets_fallback_length_check" CHECK (char_length("fallback_content") BETWEEN 1 AND 500),
  CONSTRAINT "content_targets_api_key_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade,
  CONSTRAINT "content_targets_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict,
  CONSTRAINT "content_targets_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_targets_site_key_unique"
  ON "content_targets" USING btree ("api_key_id", "target_key");
CREATE UNIQUE INDEX IF NOT EXISTS "content_targets_site_id_unique"
  ON "content_targets" USING btree ("api_key_id", "id");
CREATE INDEX IF NOT EXISTS "content_targets_site_active_idx"
  ON "content_targets" USING btree ("api_key_id", "is_active");

CREATE TABLE IF NOT EXISTS "conversion_goals" (
  "id" serial PRIMARY KEY NOT NULL,
  "api_key_id" integer NOT NULL,
  "goal_key" text NOT NULL,
  "name" text NOT NULL,
  "event_name" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "updated_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "conversion_goals_key_format_check" CHECK ("goal_key" ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT "conversion_goals_event_format_check" CHECK ("event_name" ~ '^[a-z][a-z0-9_.:-]{1,119}$'),
  CONSTRAINT "conversion_goals_name_length_check" CHECK (char_length("name") BETWEEN 1 AND 120),
  CONSTRAINT "conversion_goals_api_key_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade,
  CONSTRAINT "conversion_goals_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict,
  CONSTRAINT "conversion_goals_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversion_goals_site_key_unique"
  ON "conversion_goals" USING btree ("api_key_id", "goal_key");
CREATE UNIQUE INDEX IF NOT EXISTS "conversion_goals_site_id_unique"
  ON "conversion_goals" USING btree ("api_key_id", "id");
CREATE INDEX IF NOT EXISTS "conversion_goals_site_active_idx"
  ON "conversion_goals" USING btree ("api_key_id", "is_active");

CREATE TABLE IF NOT EXISTS "content_variants" (
  "id" serial PRIMARY KEY NOT NULL,
  "api_key_id" integer NOT NULL,
  "target_id" integer NOT NULL,
  "version" integer NOT NULL,
  "status" "content_variant_status" DEFAULT 'draft' NOT NULL,
  "content" text NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "updated_by_user_id" integer NOT NULL,
  "approved_by_user_id" integer,
  "archived_by_user_id" integer,
  "approved_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_variants_version_check" CHECK ("version" > 0),
  CONSTRAINT "content_variants_content_length_check" CHECK (char_length("content") BETWEEN 1 AND 500),
  CONSTRAINT "content_variants_approved_audit_check" CHECK ("status" <> 'approved' OR ("approved_at" IS NOT NULL AND "approved_by_user_id" IS NOT NULL)),
  CONSTRAINT "content_variants_archived_audit_check" CHECK ("status" <> 'archived' OR ("archived_at" IS NOT NULL AND "archived_by_user_id" IS NOT NULL)),
  CONSTRAINT "content_variants_api_key_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade,
  CONSTRAINT "content_variants_site_target_fk" FOREIGN KEY ("api_key_id", "target_id") REFERENCES "public"."content_targets"("api_key_id", "id") ON DELETE cascade,
  CONSTRAINT "content_variants_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict,
  CONSTRAINT "content_variants_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict,
  CONSTRAINT "content_variants_approved_by_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict,
  CONSTRAINT "content_variants_archived_by_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_variants_target_version_unique"
  ON "content_variants" USING btree ("target_id", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "content_variants_site_target_id_unique"
  ON "content_variants" USING btree ("api_key_id", "target_id", "id");
CREATE INDEX IF NOT EXISTS "content_variants_site_target_status_idx"
  ON "content_variants" USING btree ("api_key_id", "target_id", "status");

CREATE TABLE IF NOT EXISTS "content_allocations" (
  "id" serial PRIMARY KEY NOT NULL,
  "api_key_id" integer NOT NULL,
  "target_id" integer NOT NULL,
  "variant_id" integer NOT NULL,
  "conversion_goal_id" integer,
  "control_percentage" integer DEFAULT 50 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "updated_by_user_id" integer NOT NULL,
  "activated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deactivated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_allocations_control_percentage_check" CHECK ("control_percentage" BETWEEN 0 AND 100),
  CONSTRAINT "content_allocations_deactivation_check" CHECK ("is_active" OR "deactivated_at" IS NOT NULL),
  CONSTRAINT "content_allocations_api_key_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade,
  CONSTRAINT "content_allocations_site_target_fk" FOREIGN KEY ("api_key_id", "target_id") REFERENCES "public"."content_targets"("api_key_id", "id") ON DELETE cascade,
  CONSTRAINT "content_allocations_site_target_variant_fk" FOREIGN KEY ("api_key_id", "target_id", "variant_id") REFERENCES "public"."content_variants"("api_key_id", "target_id", "id") ON DELETE restrict,
  CONSTRAINT "content_allocations_site_goal_fk" FOREIGN KEY ("api_key_id", "conversion_goal_id") REFERENCES "public"."conversion_goals"("api_key_id", "id") ON DELETE restrict,
  CONSTRAINT "content_allocations_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict,
  CONSTRAINT "content_allocations_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_allocations_target_active_unique"
  ON "content_allocations" USING btree ("target_id") WHERE "is_active" = true;
CREATE INDEX IF NOT EXISTS "content_allocations_site_target_idx"
  ON "content_allocations" USING btree ("api_key_id", "target_id");

COMMIT;
