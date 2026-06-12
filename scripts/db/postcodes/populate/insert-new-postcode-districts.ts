import { loadEnvConfig } from "@next/env";
import fs from "fs/promises";
import path from "path";
import { Client } from "pg";

loadEnvConfig(process.cwd());

const INPUT_DATA_FILE_NAME = "";

const QUERY_INSERT_POSTCODE_DISTRICT_IF_NOT_EXISTS =
    `
    INSERT INTO postcode_districts (district_norm, feature, geom)
    VALUES (
        $1,
        $2::jsonb,
        ST_SetSRID(
            ST_MULTI(
                ST_GeomFromGeoJSON(
                    ($2::jsonb -> 'geometry')::text
                )
            ),
            4326
        )
    )
    ON CONFLICT (district_norm)
    DO NOTHING;
    `;

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if ( ! connectionString ) {
    throw new Error("DATABASE_URL_UNPOOLED is missing.");
}

const client = new Client({
  connectionString,
});

function normalisedDistrict(input: string) {
    return String(input).trim().toUpperCase().replace(/\s+/g, "");
}

async function main() {
    if ( !INPUT_DATA_FILE_NAME ) {
        console.log("No file specified.");
        return;
    }

    await client.connect();
    try {
        await client.query("BEGIN");

        const filePath = path.join(process.cwd(), "db/data/", INPUT_DATA_FILE_NAME);
        const raw = await fs.readFile(filePath, "utf8");
        const data = JSON.parse(raw);

        let inserted = 0;
        let failed = 0;
        let skipped = 0;
        for (const feature of data.features) {
            const props = feature.properties ?? {};
            const rawDistrictCode = props.name ?? null;

            if (rawDistrictCode == null || String(rawDistrictCode).trim() == "") {
                console.log(`On insertion ${inserted + failed + 1} no property name found.`);
                failed += 1;
                continue;
            }

            const normDistrictCode = normalisedDistrict(rawDistrictCode);

            const result = await client.query(
                QUERY_INSERT_POSTCODE_DISTRICT_IF_NOT_EXISTS,
                [normDistrictCode, JSON.stringify(feature)]
            );

            if (result.rowCount === 1) {
                inserted += 1;
            } else {
                skipped += 1;
            }
        }

        await client.query("COMMIT");

        console.log("Population complete");
        console.log(`Inserted ${inserted} records`);
        console.log(`Skipped ${skipped} existing records`);
        console.log(`Failed ${failed} records missing district`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error("Operation failed");
    console.error(err);
    process.exit(1);
});