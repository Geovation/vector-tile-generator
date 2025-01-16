create extension postgis;

create table flood_risk_rivers_and_sea
(
    geom geometry(Geometry,27700),
    prob_4band character varying(20),
    suitabilit character varying(30),
    pub_date date,
    st_area_sh double precision,
    st_perimet double precision
)

create index flood_risk_rivers_and_sea_geom_idx on flood_risk_rivers_and_sea using gist(geom);


CREATE TABLE IF NOT EXISTS public.low_emission_zones
(
    geom geometry(Geometry,4258),
    name character varying COLLATE pg_catalog."default",
    url character varying COLLATE pg_catalog."default"
)

CREATE INDEX low_emission_zones_geom_idx
    ON public.low_emission_zones USING gist (geom);