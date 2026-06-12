import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

loadEnvConfig(process.cwd());

type ExistsRow = {
    exists: boolean;
};

type CountRow = {
    count: number;
};

type InvalidCountRow = {
    invalid_count: number;
};

type NeighbourRow = {
    neighbour_district_norm: string;
};

const SAMPLE_DISTRICTS = ["CM21", "CM20"];

const QUERY_POSTGIS_EXISTS = `
    SELECT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'postgis'
    ) AS exists;
`;

const QUERY_POSTCODE_DISTRICTS_EXISTS = `
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'postcode_districts'
    ) AS exists;
`;

const QUERY_POSTCODE_ADJACENCY_EXISTS = `
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'postcode_adjacency'
    ) AS exists;
`;

const QUERY_GEOM_COLUMN_EXISTS = `
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'postcode_districts'
          AND column_name = 'geom'
    ) AS exists;
`;

const QUERY_COUNT_POSTCODE_DISTRICTS = `
    SELECT COUNT(*)::int AS count
    FROM postcode_districts;
`;

const QUERY_COUNT_INVALID_GEOMETRIES = `
    SELECT COUNT(*)::int AS invalid_count
    FROM postcode_districts
    WHERE geom IS NULL OR NOT ST_IsValid(geom);
`;

const QUERY_REBUILD_POSTCODE_ADJACENCY = `
    INSERT INTO postcode_adjacency (
        district_norm,
        neighbour_district_norm
    )
    SELECT
        a.district_norm,
        b.district_norm
    FROM postcode_districts a
    JOIN postcode_districts b
      ON a.district_norm <> b.district_norm
     AND a.geom && b.geom
     AND ST_Touches(a.geom, b.geom);
`;

const QUERY_COUNT_ADJACENCY_ROWS = `
    SELECT COUNT(*)::int AS count
    FROM postcode_adjacency;
`;

const QUERY_GET_SAMPLE_NEIGHBOURS = `
    SELECT neighbour_district_norm
    FROM postcode_adjacency
    WHERE district_norm = $1
    ORDER BY neighbour_district_norm;
`;

async function assertExists(
    client: Client,
    query: string,
    errorMessage: string
): Promise<void> {
    const result = await client.query<ExistsRow>(query);
    const exists = result.rows[0]?.exists;

    if (!exists) {
        throw new Error(errorMessage);
    }
}

async function main(): Promise<void> {
    const connectionString = process.env.DATABASE_URL_UNPOOLED;

    if (!connectionString) {
        throw new Error("Missing DATABASE_URL_UNPOOLED.");
    }

    const client = new Client({
        connectionString,
    });

    await client.connect();

    try {
        console.log("(1) Checking that PostGIS extension exists...");
        await assertExists(
            client,
            QUERY_POSTGIS_EXISTS,
            "PostGIS extension does not exist."
        );

        console.log("(2) Checking required tables exist...");
        await assertExists(
            client,
            QUERY_POSTCODE_DISTRICTS_EXISTS,
            "Table postcode_districts does not exist. Run migrations first."
        );

        await assertExists(
            client,
            QUERY_POSTCODE_ADJACENCY_EXISTS,
            "Table postcode_adjacency does not exist. Run migrations first."
        );

        console.log("(3) Checking postcode_districts.geom exists...");
        await assertExists(
            client,
            QUERY_GEOM_COLUMN_EXISTS,
            "Column postcode_districts.geom does not exist."
        );

        console.log("(4) Checking postcode_districts has data...");
        const districtCountResult = await client.query<CountRow>(
            QUERY_COUNT_POSTCODE_DISTRICTS
        );
        const districtCount = districtCountResult.rows[0]?.count ?? 0;

        if (districtCount === 0) {
            throw new Error(
                "postcode_districts is empty. Populate postcode districts before building adjacency."
            );
        }

        console.log(`   postcode_districts rows: ${districtCount}`);

        console.log("(5) Checking for invalid/null geometries...");
        const invalidCountResult = await client.query<InvalidCountRow>(
            QUERY_COUNT_INVALID_GEOMETRIES
        );
        const invalidCount = invalidCountResult.rows[0]?.invalid_count ?? 0;

        if (invalidCount > 0) {
            throw new Error(
                `Cannot safely build adjacency: ${invalidCount} postcode geometries are null or invalid. Run geometry repair/check first.`
            );
        }

        console.log("   All postcode geometries are valid.");

        console.log("(6) Rebuilding postcode_adjacency...");
        await client.query("BEGIN");

        try {
            await client.query("SELECT pg_advisory_xact_lock(69696969);");

            await client.query("TRUNCATE postcode_adjacency;");

            const rebuildResult = await client.query(
                QUERY_REBUILD_POSTCODE_ADJACENCY
            );

            await client.query("ANALYZE postcode_adjacency;");

            await client.query("COMMIT");

            console.log(`   Inserted adjacency rows: ${rebuildResult.rowCount ?? 0}`);
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }

        console.log("(7) Checking adjacency table count...");
        const adjacencyCountResult = await client.query<CountRow>(
            QUERY_COUNT_ADJACENCY_ROWS
        );
        const adjacencyCount = adjacencyCountResult.rows[0]?.count ?? 0;

        if (adjacencyCount === 0) {
            throw new Error("No adjacency rows created.");
        }

        console.log(`   postcode_adjacency rows: ${adjacencyCount}`);

        if (adjacencyCount % 2 !== 0) {
            console.warn(
                "Warning: adjacency row count is odd. Expected symmetric A→B and B→A rows."
            );
        }

        console.log("(8) Printing sample neighbour checks...");
        for (const district of SAMPLE_DISTRICTS) {
            console.log(`   Neighbours of ${district}:`);

            const neighbours = await client.query<NeighbourRow>(
                QUERY_GET_SAMPLE_NEIGHBOURS,
                [district]
            );

            console.table(neighbours.rows);
        }

        console.log("Postcode adjacency build complete.");
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error("Build postcode adjacency failed.");
    console.error(error);
    process.exit(1);
});