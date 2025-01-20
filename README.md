# Vector tile generator

A repository to demo and test a few methods of generating vector tiles

## Installation

### Local database

The testing was done using a local database server installed on MacOS using homebrew.

```bash
brew install postgresql postgis
```

After these are installed you may need to run some steps to ensure the pg commands are available in your shell. In some cases there can be conflicts with the default MacOS database files location, but you can initialise the data directory in a different location.

```bash
pg_ctl -D postgres start
```

### Packages

The node packages are installed using npm. The package.json file contains the dependencies.

```bash
npm install
```

### Tippecanoe

The tippecanoe method is using node but is a wrapper around a local install of tippecanoe. Tippecanoe is a command line utility for converting GeoJSON to vector tiles. It can also be installed using homebrew (or various other methods).

```bash
brew install tippecanoe
```
