# Vector tile generator

A repository to demo and test a few methods of generating vector tiles

## Installation

### Local database

The testing was done using a local database server installed on MacOS using homebrew.

```bash
brew install postgresql postgis
```

After these are installed you may need to run some steps to ensure the pg commands are available in your shell. See guidance online for install such as [How to install PostgreSQL on a Mac with Homebrew](https://www.moncefbelyamani.com/how-to-install-postgresql-on-a-mac-with-homebrew-and-lunchy/)In some cases there can be conflicts with the default MacOS database files location, but you can initialise the data directory in a different location.

```bash
pg_ctl -D postgres start
```

### Setup packages

The node packages are installed using npm. The package.json file contains the dependencies.

```bash
npm install
```

#### Tippecanoe

The tippecanoe method is using node but is a wrapper around a local install of tippecanoe. Tippecanoe is a command line utility for converting GeoJSON to vector tiles. It can also be installed using homebrew (or various other methods).

```bash
brew install tippecanoe
```

#### GDAL

In part of the process we generate a GeoJSON file from a CSV exported from the database. This is done using the ogr2ogr command line utility from the GDAL package. This can also be installed using homebrew.

```bash
brew install gdal
```

## Instructions

The three different methods of generating tiles are `tippecanoeBulk`, `vtPbfSequential` and `databaseSequential`.

First take a copy of the sample environment file, rename to `.env` and update the values to match your local database and the layer you wish to convert to vector tiles. For example:

```bash
DB_TABLE=flood_risk_rivers_and_sea
DB_COLUMNS=prob_4band,suitabilit,pub_date,st_area_sh,st_perimet
MIN_ZOOM_LEVEL=4
MAX_ZOOM_LEVEL=14
```

When you are ready to try it out ensure you have a database running and the table you want to convert is available. Then run the following command:

```bash
node --max-old-space-size=24576 ./index.js tippecanoeBulk
```

Replace `tippecanoeBulk` with `vtPbfSequential` or `databaseSequential` to try the other methods.

## Performance

Some basic timings were taken for the different methods.

| Features | Method     | Time   |
| -------- | ---------- | ------ |
| 16       | Tippecanoe | 0.7s   |
| 16       | vtPbf      | 1.7s   |
| 16       | PostGIS    | 29.1s  |
| 1525731  | Tippecanoe | 449.6s |
