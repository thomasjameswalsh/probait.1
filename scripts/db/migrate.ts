import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

loadEnvConfig(process.cwd());

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
const BOOTSTRAP_MIGRATION = "000_create_schema_migrations.sql";

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if ( ! connectionString ) {
    throw new Error("DATABASE_URL_UNPOOLED does not exist.");
}

function parseMigrationFilename(filename: string): {
    version: string;
    name: string;
} {
    const match = filename.match(/^(\d{3})_(.+)\.sql$/);

    if ( !match ) {
        throw new Error(
            `Invalid migration filename "${filename}". Expected format like "001_create_users.sql".`
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
    console.log(`Applying migration: ${migration.filename}`);

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

        console.log(`Applied migration: ${migration.filename}`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
}

async function main(): Promise<void> {
    const client = new Client({
        connectionString: connectionString,
    });

    await client.connect();

    try {
        await bootstrapSchemaMigrationsTable(client);

        const migrationFiles = await getMigrationFiles();
        const appliedMigrations = await getAppliedMigrations(client);

        for ( const filename of migrationFiles ) {
            const migration: MigrationFile = await loadMigrationFile(filename);

            const appliedMigration = appliedMigrations.get(migration.version);

            if ( appliedMigration ) {
                if ( migration.name !== appliedMigration.name ) {
                    throw new Error(
                        `Migration ${migration.version} was applied as ${appliedMigration.name} ` +
                        `but is now named as ${migration.name}.\n` +
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
                continue;
            }

            await applyMigration(client, migration);
        }

        console.log("All migrations complete.");
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
