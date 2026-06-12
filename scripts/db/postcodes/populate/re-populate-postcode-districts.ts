import { loadEnvConfig } from "@next/env";
import fs from "fs/promises";
import path from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { Client } from "pg";

loadEnvConfig(process.cwd());

const INPUT_DATA_FILE_NAME = "PostcodeDistrictsPolygons_multi.json";

const CONFIRMATION_PHRASE = "DRAKE-JAPAN-SKINCARE-69";

const QUERY_UPSERT_POSTCODE_DISTRICT = `
  INSERT INTO postcode_districts (district_norm, feature, geom)
  VALUES (
    $1,
    $2::jsonb,
    ST_SetSRID(
      ST_Multi(
        ST_GeomFromGeoJSON(
          ($2::jsonb -> 'geometry')::text
        )
      ),
      4326
    )
  )
  ON CONFLICT (district_norm)
  DO UPDATE SET
    feature = EXCLUDED.feature,
    geom = EXCLUDED.geom,
    updated_at = now();
`;

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if ( !connectionString ) {
    throw new Error("DATABASE_URL_UNPOOLED is missing.");
}

const client = new Client({
    connectionString,
});

function normalisedDistrict(input: string): string {
    return String(input).trim().toUpperCase().replace(/\s+/g, "");
}

async function confirmProceed(): Promise<boolean> {
    console.log("");
    console.log("WARNING: This script will update existing postcode records on conflict.");
    console.log("Existing feature JSON and PostGIS geometry may be replaced.");
    console.log("");
    console.log(`To continue, type exactly: ${CONFIRMATION_PHRASE}`);
    console.log("");

    const rl = readline.createInterface({ input, output });

    try {
        const answer = await rl.question("> ");
        return answer.trim() === CONFIRMATION_PHRASE;
    } finally {
        rl.close();
    }
}

async function main(): Promise<void> {
    if ( !INPUT_DATA_FILE_NAME ) {
        console.log("No file specified. Nothing done.");
        return;
    }

    const confirmed = await confirmProceed();
    if ( !confirmed ) {
        console.log("Confirmation phrase not entered. Nothing done.");
        return;
    }

    await client.connect();
    try {
        await client.query("BEGIN");

        const filePath = path.join(process.cwd(), "db", "data", INPUT_DATA_FILE_NAME);
        const raw = await fs.readFile(filePath, "utf8");
        const data = JSON.parse(raw);

        let insertedOrUpdated = 0;
        let failed = 0;

        for (const feature of data.features) {
            const props = feature.properties ?? {};
            const rawDistrictCode = props.name ?? null;

            if (rawDistrictCode == null || String(rawDistrictCode).trim() === "") {
                console.log(`On feature ${insertedOrUpdated + failed + 1} no property name found.`);
                failed += 1;
                continue;
            }

            const normDistrictCode = normalisedDistrict(String(rawDistrictCode));

            await client.query(
                QUERY_UPSERT_POSTCODE_DISTRICT,
                [normDistrictCode, JSON.stringify(feature)]
            );

            insertedOrUpdated += 1;
        }

        await client.query("COMMIT");

        console.log("Upsert re-population with updates complete");
        console.log(`Inserted or updated ${insertedOrUpdated} records`);
        console.log(`Failed ${failed} records missing district`);
    } catch ( error ) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        await client.end();
    }
}

main()
.catch((error) => {
    console.error("Operation failed");
    console.error(error);
    process.exit(1);
});