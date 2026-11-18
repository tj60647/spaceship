CREATE TABLE "spaceship_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaceship_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"model" text NOT NULL,
	"operation" text NOT NULL,
	"cost" double precision NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tokens" integer,
	"latency" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaceship_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaceship_members" (
	"email" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"role" text DEFAULT 'participant' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spaceship_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "spaceship_sessions" (
	"hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaceship_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"budget" double precision DEFAULT 0 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spaceship_calls" ADD CONSTRAINT "spaceship_calls_email_spaceship_members_email_fk" FOREIGN KEY ("email") REFERENCES "public"."spaceship_members"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaceship_sessions" ADD CONSTRAINT "spaceship_sessions_email_spaceship_members_email_fk" FOREIGN KEY ("email") REFERENCES "public"."spaceship_members"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spaceship_calls_email_time_idx" ON "spaceship_calls" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "spaceship_sessions_email_idx" ON "spaceship_sessions" USING btree ("email");