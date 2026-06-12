export const GET_POSTCODE_QUERY =
    `
    SELECT district_norm, feature
    FROM postcode_districts
    WHERE district_norm = $1
    LIMIT 1
`;