import os
import osmnx as ox
import psycopg2
import uuid

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgres://postgres:password@localhost:5432/flood_evacuation?sslmode=disable",
)

# Download road network for Gal Oya / Ampara District
print("Downloading road data from OSM...")
G = ox.graph_from_place("Ampara District, Eastern Province, Sri Lanka", network_type="drive")

# Convert to GeoDataFrame
edges = ox.graph_to_gdfs(G, nodes=False)
print(f"Downloaded {len(edges)} road segments")

# Connect to DB (psycopg2 accepts a libpq/SQLAlchemy-style URI directly)
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Clear dummy data
cur.execute("DELETE FROM flood_system.road_segments;")

inserted = 0
for idx, row in edges.iterrows():
    geom = row.geometry
    start_point = geom.coords[0]
    end_point = geom.coords[-1]
    road_name = row.get("name", None)
    if isinstance(road_name, list):
        road_name = road_name[0]
    road_type = row.get("highway", None)
    if isinstance(road_type, list):
        road_type = road_type[0]
    length_m = row.get("length", None)
    oneway = bool(row.get("oneway", False))
    osm_id_raw = row.get("osmid", None)
    if isinstance(osm_id_raw, list):
        osm_id_raw = osm_id_raw[0]
    osm_id = osm_id_raw

    cur.execute("""
        INSERT INTO flood_system.road_segments
            (segment_id, road_name, osm_id, geometry, start_point, end_point,
             length_meters, road_type, is_one_way)
        VALUES (
            %s, %s, %s,
            ST_SetSRID(ST_GeomFromText(%s), 4326),
            ST_SetSRID(ST_MakePoint(%s, %s), 4326),
            ST_SetSRID(ST_MakePoint(%s, %s), 4326),
            %s, %s, %s
        )
        ON CONFLICT (osm_id) DO NOTHING;
    """, (
        str(uuid.uuid4()),
        road_name,
        osm_id,
        geom.wkt,
        start_point[0], start_point[1],
        end_point[0], end_point[1],
        length_m,
        road_type,
        oneway
    ))
    inserted += 1

conn.commit()
cur.close()
conn.close()
print(f"Inserted {inserted} road segments successfully.")
