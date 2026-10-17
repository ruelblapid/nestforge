import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792227225837 implements MigrationInterface {
    name = 'InitialSchema1792227225837'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "auths" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "id" character varying NOT NULL,
                "email" character varying NOT NULL,
                "password_hash" character varying,
                "roles" character varying array NOT NULL DEFAULT '{user}',
                "refresh_token_hash" character varying,
                "google_id" character varying,
                "apple_id" character varying,
                "last_login_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_22fc0631a651972ddc9c5a31090" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_auths_apple_live" ON "auths" ("apple_id")
            WHERE "deleted_at" IS NULL
                AND "apple_id" IS NOT NULL
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_auths_google_live" ON "auths" ("google_id")
            WHERE "deleted_at" IS NULL
                AND "google_id" IS NOT NULL
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_auths_email_live" ON "auths" ("email")
            WHERE "deleted_at" IS NULL
        `);
        await queryRunner.query(`
            CREATE TABLE "profiles" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "id" character varying NOT NULL,
                "auth_id" character varying NOT NULL,
                "name" character varying NOT NULL,
                "lastname" character varying,
                "age" integer,
                CONSTRAINT "REL_3286880f67d006b92094326dd8" UNIQUE ("auth_id"),
                CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_profiles_auth_live" ON "profiles" ("auth_id")
            WHERE "deleted_at" IS NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "profiles"
            ADD CONSTRAINT "FK_3286880f67d006b92094326dd8a" FOREIGN KEY ("auth_id") REFERENCES "auths"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "profiles" DROP CONSTRAINT "FK_3286880f67d006b92094326dd8a"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_profiles_auth_live"
        `);
        await queryRunner.query(`
            DROP TABLE "profiles"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_auths_email_live"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_auths_google_live"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_auths_apple_live"
        `);
        await queryRunner.query(`
            DROP TABLE "auths"
        `);
    }

}
