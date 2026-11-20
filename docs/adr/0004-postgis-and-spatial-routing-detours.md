# ADR 0004: PostGIS and Spatial Route Detour Matching

## Status
Accepted

## Context
Early prototypes used straight-line Euclidean distance formulas and hard-coded landmark coordinates, which fail to model real road-network topology, one-way streets, campus gates, and accurate detour overheads.

## Decision
1. Adopt PostgreSQL with **PostGIS** (`postgis/postgis:16-3.4`) storing spatial data as `geography(Point, 4326)` for origins/destinations and `geography(LineString, 4326)` for planned routes.
2. Two-stage candidate retrieval:
   - Filter hard constraints in SQL (campus ID, departure time window, available seats, mutual blocks, gender constraints).
   - Spatial candidate search using PostGIS `ST_DWithin` and `ST_LineLocatePoint`.
3. Scoring combines road detour minutes, time gap, route overlap, and driver reputation with human-explainable breakdown reasons.

## Consequences
- Accurate detour estimates avoiding unviable pickups.
- High-performance indexed candidate search using spatial GiST indexes.
