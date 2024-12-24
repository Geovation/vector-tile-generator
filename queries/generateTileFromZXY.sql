with tile_params as ( 
  select
    $1::int as mvt_z,
    $2::int as mvt_x,
    $3::int as mvt_y
),
srid AS ( -- Get the SRID of the table
  select
    st_srid(geom) AS srid
  from
    {{table_name}}
  limit 1
),
tile_envelope AS (
  SELECT
    st_tileenvelope(mvt_z, mvt_x, mvt_y) AS tile_envelope 
    from tile_params -- In 3857 by default
),
tile_envelope_transformed AS (
  SELECT
    st_transform(tile_envelope.tile_envelope, srid) AS tile_envelope_transformed -- Envelope in the SRID of the table
  FROM
    tile_envelope, srid
),
mvtgeom as (
    select
        ST_AsMVTGeom(
        	st_transform(geom, 3857), -- Transform the geometry to 3857
        	tile_envelope.tile_envelope,
        	4096,
        	0,
        	true
        ) AS geom,
    {{columns}}
    from {{table_name}} t, tile_envelope, tile_envelope_transformed
    where ST_Intersects(geom, tile_envelope_transformed.tile_envelope_transformed)
)
select ST_AsMVT(mvtgeom.*, '{{table_name}}') as mvt
from mvtgeom;