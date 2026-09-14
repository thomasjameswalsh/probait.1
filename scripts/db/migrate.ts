import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import {
    startMigrationLog,
    logMigration,
} from "./migration-log";


type AppliedMigration = {
    version: string;
    name: string;
    checksum: string;
};

type MigrationFile = {
    filename: string;
    version: string;
    name: string;
    sql: string;
    checksum: string;
};

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
const BOOTSTRAP_MIGRATION = "0000_create_schema_migrations.sql";


function isBlankMigration(sql: string): boolean {
    const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
    const withoutLineComments = withoutBlockComments.replace(/--.*$/gm, "");
    return withoutLineComments.trim().length === 0;
}


function parseMigrationFilename(filename: string): {
    version: string;
    name: string;
} {
    const match = filename.match(/^(\d{4})_(.+)\.sql$/);

    if ( !match ) {
        throw new Error(
            `Invalid migration filename "${filename}". Expected format like "0001_create_users.sql".`
        );
    }

    return {
        version: match[1],
        name: match[2],
    };
}


async function bootstrapSchemaMigrationsTable(client: Client): Promise<void> {
    const filepath = path.join(MIGRATIONS_DIR, BOOTSTRAP_MIGRATION);
    const sql = await fs.readFile(filepath, "utf8");

    await client.query(sql);
}

async function getMigrationFiles(): Promise<string[]> {
    const filenames = await fs.readdir(MIGRATIONS_DIR);

    return filenames
        .filter((filename: string) => filename.endsWith(".sql"))
        .filter((filename: string) => filename != BOOTSTRAP_MIGRATION)
        .sort();
}


async function getAppliedMigrations(
    client: Client
): Promise<Map<string, AppliedMigration>> {
    const result = await client.query<AppliedMigration>(`
    SELECT version, name, checksum
    FROM schema_migrations
    ORDER BY version;
  `);

    return new Map(
        result.rows.map((migration) => [migration.version, migration])
    );
}


async function loadMigrationFile(filename: string): Promise<MigrationFile> {
    const { version, name } = parseMigrationFilename(filename);

    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = await fs.readFile(filepath, "utf8");

    const checksum = createHash("sha256").update(sql).digest("hex");

    return {
        filename,
        version,
        name,
        sql,
        checksum,
    };
}


async function applyMigration(
    client: Client,
    migration: MigrationFile
): Promise<void> {

    if ( isBlankMigration(migration.sql) ) {
        console.log(`Blank migration: ${migration.filename} skipped.`);
        logMigration(`SKIPPED blank: ${migration.filename}`);
        return;
    }

    console.log(`Applying migration: ${migration.filename}`);
    logMigration(`RUNNING ${migration.filename}`);

    await client.query("BEGIN");

    try {
        await client.query(migration.sql);

        await client.query(
            `
                INSERT INTO schema_migrations (version, name, checksum)
                VALUES ($1, $2, $3);
            `,
            [migration.version, migration.name, migration.checksum]
        );

        await client.query("COMMIT");
    } catch (error) {
        logMigration(`ROLLBACK migration ${migration.filename}`);

        try {
            await client.query("ROLLBACK");
        } catch( rollbackError ) {
            logMigration(`ROLLBACK ERROR on ${migration.filename}`, rollbackError);
        }

        throw error;
    }

    console.log(`\t \t Applied migration: ${migration.filename}`);
    logMigration(`APPLIED ${migration.filename}`);
}

async function main(): Promise<void> {
    startMigrationLog();

    let client: Client | undefined;
    let failed = false;
    let step = "loading environment";

    try {
        loadEnvConfig(process.cwd());

        const connectionString = process.env.DATABASE_URL_UNPOOLED;

        if ( ! connectionString ) {
            throw new Error("DATABASE_URL_UNPOOLED does not exist.");
        }

        step = "connecting to database";
        client = new Client({ connectionString });
        await client.connect();

        step = BOOTSTRAP_MIGRATION;
        logMigration(`${BOOTSTRAP_MIGRATION} — RUNNING`);
        await bootstrapSchemaMigrationsTable(client);
        logMigration(`${BOOTSTRAP_MIGRATION} — RUN SUCCESSFULLY`);

        step = "reading migration directory";
        const migrationFiles = await getMigrationFiles();

        step = "reading applied migrations";
        const appliedMigrations = await getAppliedMigrations(client);

        for ( const filename of migrationFiles ) {
            step = filename;

            const migration = await loadMigrationFile(filename);
            const appliedMigration = appliedMigrations.get(migration.version);

            if ( appliedMigration ) {
                if ( migration.name !== appliedMigration.name ) {
                    throw new Error(
                        `Migration ${migration.version} was applied as ` +
                        `${appliedMigration.name} but is now named as ` +
                        `${migration.name}.\n` +
                        `Create a new migration instead of renaming an old one.`
                    );
                }

                if ( migration.checksum !== appliedMigration.checksum ) {
                    throw new Error(
                        `Migration ${filename} has changed since it was applied. ` +
                        `Create a new migration instead of editing this one.`
                    );
                }

                console.log(`Already applied: ${filename}`);
                logMigration(
                    `${filename} — SKIPPED (already run)`
                );
                continue;
            }

            await applyMigration(client, migration);
        }
    } catch ( error ) {
        failed = true;
        process.exitCode = 1;

        console.error(error);
        logMigration(`${step} — ERROR`, error);
    } finally {
        if ( client ) {
            try {
                await client.end();
            } catch ( error ) {
                failed = true;
                process.exitCode = 1;

                console.error("Database connection cleanup failed:", error);
                logMigration(
                    "Closing database connection — ERROR",
                    error
                );
            }
        }

        if ( failed || process.exitCode ) {
            logMigration("FINISHED with errors");
        } else {
            logMigration("FINISHED successfully");
            console.log("All migrations complete.");
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});