// Though not 'using' the geometry structure yet,
// rather just passing data into the db,
// established here is a ts model of the geojson structure
// for later use and reference

export type Position = [number, number];

export type LinearRing = Position[];
export type PolygonCoordinates = LinearRing[];
export type MultiPolygonCoordinates = PolygonCoordinates[];

export type PolygonGeometry = {
    type: "Polygon",
    coordinates: PolygonCoordinates
};

export type MultiPolygonGeometry = {
    type: "MultiPolygon",
    coordinates: MultiPolygonCoordinates
};

export type Geometry = PolygonGeometry | MultiPolygonGeometry;

export type GeojsonFeature = {
    type: "Feature",
    geometry: Geometry,
    properties: {
        name: string
    }
};

export type GeojsonFeatureCollection = {
    type: "FeatureCollection",
    features: GeojsonFeature[]
};