select
  {{columns}},
  st_astext(st_reduceprecision(st_transform(st_makevalid(geom), 4326), 0.000001)) AS geom
from
  {{table_name}}