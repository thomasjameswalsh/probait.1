CREATE TABLE IF NOT EXISTS postcode_adjacency (
    district_norm text NOT NULL,
    neighbour_district_norm text NOT NULL,

    PRIMARY KEY (district_norm, neighbour_district_norm),

    CONSTRAINT postcode_adjacency_not_self_check
    CHECK (district_norm <> neighbour_district_norm),

    CONSTRAINT postcode_adjacency_district_fk
    FOREIGN KEY (district_norm)
    REFERENCES postcodes (district_norm)
    ON DELETE CASCADE,

    CONSTRAINT postcode_adjacency_neighbour_fk
    FOREIGN KEY (neighbour_district_norm)
    REFERENCES postcodes (district_norm)
    ON DELETE CASCADE
    );