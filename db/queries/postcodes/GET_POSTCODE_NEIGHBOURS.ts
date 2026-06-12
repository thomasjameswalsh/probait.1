export const GET_POSTCODE_NEIGHBOURS_QUERY =
    `
    SELECT
        p.district_norm,
        p.feature
    FROM postcode_adjacency AS a
    JOIN postcode_districts AS p
        ON p.district_norm = a.neighbour_district_norm
    WHERE a.district_norm = $1
    ORDER BY p.district_norm;
    `;