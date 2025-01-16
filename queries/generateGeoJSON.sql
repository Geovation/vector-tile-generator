with geojson as (
  select
    jsonb_build_object(
      'type', 'FeatureCollection',
      'features', jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::jsonb,
          'properties', to_jsonb(row) - 'geom'
        )
      )
    ) as data
  from (
    select
      {{columns}},
      st_reduceprecision(st_transform(st_makevalid(geom), 4326), 0.000001) as geom
    from
      {{table_name}}
  ) row
)
select data
from geojson