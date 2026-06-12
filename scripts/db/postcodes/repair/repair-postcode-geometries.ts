import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

loadEnvConfig(process.cwd());

type InvalidCountRow = {
    invalid_count: number;
};

type InvalidDetailRow = {
    district_norm: string;
    invalid_reason: string;
};

const QUERY_POSTGIS_EXISTS =
    `
    SELECT EXISTS
    (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'postgis'
    ) AS postgis_exists;
    `;

const QUERY_CHECK_GEOM_COLUMN_EXISTS =
    `
    SELECT EXISTS
    (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'postcode_districts' AND column_name = 'geom'
    ) AS geom_exists;
    `;

const QUERY_INVALID_COUNT =
    `
    SELECT COUNT(*)::int AS invalid_count
    FROM postcode_districts
    WHERE geom IS NULL OR NOT ST_IsValid(geom);
    `;

const QUERY_INVALID_DETAILS =
    `
    SELECT
        district_norm,
        CASE
            WHEN geom IS NULL THEN 'geom is NULL'
            ELSE ST_IsValidReason(geom)
        END AS invalid_reason
    FROM postcode_districts
    WHERE geom IS NULL OR NOT ST_IsValid(geom)
    ORDER BY district_norm
    LIMIT 20;
    `;

const QUERY_REBUILD_INVALID_GEOM =
    `
    UPDATE postcode_districts
    SET geom = ST_SetSRID(
        ST_Multi(
            ST_CollectionExtract(
                ST_MakeValid(
                    ST_GeomFromGeoJSON(
                        (feature->'geometry')::text
                    )
                ),
                3
            )
        ),
        4326
    )
    WHERE geom IS NULL OR NOT ST_IsValid(geom);
    `;

async function main() {
    const connectionString = process.env.DATABASE_URL_UNPOOLED;

    if ( ! connectionString ) {
        throw new Error("Missing DATABASE_URL_UNPOOLED.");
    }

    const client = new Client({
        connectionString,
    });

    await client.connect();

    try {
        console.log("(1) Checking that PostGIS extension exists...");
        const postgis_exists = await client.query(QUERY_POSTGIS_EXISTS);
        const flag_postgis = postgis_exists.rows[0]?.postgis_exists;
        if ( ! flag_postgis ) throw new Error("PostGIS extension does not exist.");

        console.log("(2) Checking that the 'geom' column exists...");
        const geom_exists = await client.query(QUERY_CHECK_GEOM_COLUMN_EXISTS);
        const flag_geom = geom_exists.rows[0]?.geom_exists;
        if ( ! flag_geom ) throw new Error("Geom column does not exist.");

        console.log("(3) Counting invalid/null geometries before repair...");
        const invalidCountBeforeRepair = await client.query<InvalidCountRow>(
            QUERY_INVALID_COUNT
        );
        const invalidCount = invalidCountBeforeRepair.rows[0]?.invalid_count ?? 0;
        console.log(`   Invalid/null geom rows before repair: ${invalidCount}`);

        if ( invalidCount ) {
            console.log("(4) Print first 20 invalid rows:\n");
            const invalidDetailsBeforeRepair = await client.query<InvalidDetailRow>(
                QUERY_INVALID_DETAILS
            );
            console.table(invalidDetailsBeforeRepair.rows);
        } else {
            console.log("Result: No invalid geometries found. Nothing to repair.");
        }

        console.log("(5) Rebuilding all invalid geometries from feature...");
        try {
            await client.query("BEGIN");
            const rebuildResult = await client.query(QUERY_REBUILD_INVALID_GEOM);
            await client.query("COMMIT");

            console.log(`Rows rebuilt: ${rebuildResult.rowCount ?? 0}`);
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        }

        console.log("(6) Counting invalid geometries after repair...");
        const invalidCountAfterRepair = await client.query<InvalidCountRow>(
            QUERY_INVALID_COUNT
        );
        const finalInvalidCount = invalidCountAfterRepair.rows[0]?.invalid_count ?? 0;
        console.log(`The number of invalid geometries after repair: ${finalInvalidCount}`);

        if ( finalInvalidCount > 0 ) {
            console.log("(7) First 20 invalid rows after repair:");
            const invalidDetailsAfterRepair = await client.query<InvalidDetailRow>(
                QUERY_INVALID_DETAILS
            );
            console.table(invalidDetailsAfterRepair.rows);
        } else {
            console.log("Result: Repaired successfully. All geometries are now valid.");
        }

        console.log("Geometry repair script complete.");
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error("Geometry validation/repair script failed.");
    console.error(error);
    process.exit(1);
});