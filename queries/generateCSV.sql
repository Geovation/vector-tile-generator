select
  {{columns}},
  st_astext(st_transform(geom, 4326)) AS geom
from
  {{table_name}}