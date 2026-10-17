import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLoginCodes1792228511636 implements MigrationInterface {
    name = 'AddLoginCodes1792228511636'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "login_codes" (
                "code_hash" character varying NOT NULL,
                "auth_id" character varying NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_7869623b464d15ba8325fae3506" PRIMARY KEY ("code_hash")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_login_codes_expires_at" ON "login_codes" ("expires_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX "public"."idx_login_codes_expires_at"
        `);
        await queryRunner.query(`
            DROP TABLE "login_codes"
        `);
    }

}
