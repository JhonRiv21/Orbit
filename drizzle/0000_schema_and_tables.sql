CREATE SCHEMA IF NOT EXISTS "orbit";
--> statement-breakpoint
CREATE TABLE "orbit"."ingest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"fetched" integer DEFAULT 0 NOT NULL,
	"upserted" integer DEFAULT 0 NOT NULL,
	"removed" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "orbit"."satellites" (
	"norad_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"intl_designator" text,
	"category" text NOT NULL,
	"orbit_class" text NOT NULL,
	"epoch" timestamp with time zone NOT NULL,
	"mean_motion" double precision NOT NULL,
	"eccentricity" double precision NOT NULL,
	"inclination" double precision NOT NULL,
	"raan" double precision NOT NULL,
	"arg_pericenter" double precision NOT NULL,
	"mean_anomaly" double precision NOT NULL,
	"bstar" double precision NOT NULL,
	"mean_motion_dot" double precision NOT NULL,
	"mean_motion_ddot" double precision NOT NULL,
	"element_set_no" integer NOT NULL,
	"rev_at_epoch" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ingest_runs_started_at_idx" ON "orbit"."ingest_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "satellites_category_idx" ON "orbit"."satellites" USING btree ("category");