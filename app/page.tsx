import { Client } from "pg";

export default async function Home() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED,
  });

  await client.connect();

  const district = await client.query(
      `
        SELECT district_norm, feature
        FROM postcode_districts
        WHERE district_norm = 'CM21';
        `
  );

  const neighbours = await client.query(
      `
        SELECT neighbour_district_norm
        FROM postcode_adjacency
        WHERE district_norm = 'CM21'
        ORDER BY neighbour_district_norm;
        `
  );

  await client.end();

  return (
      <main style={{ padding: 24 }}>
        <h1>CM21 Test</h1>

        <h2>Neighbours</h2>
        <pre>{JSON.stringify(neighbours.rows, null, 2)}</pre>

        <h2>Feature JSON</h2>
        <pre>{JSON.stringify(district.rows[0], null, 2)}</pre>
      </main>
  );
}