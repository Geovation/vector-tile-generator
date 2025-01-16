import { pool } from './dbConnection.js'

import csvtojson from 'csvtojson'

import tippecanoe from 'tippecanoe'

import geojsonvt from 'geojson-vt'

import vtpbf from 'vt-pbf'

import { pipeline } from 'node:stream/promises'

import { to as copyTo } from 'pg-copy-streams'

import { wktToGeoJSON } from '@terraformer/wkt'

import fs from 'fs'

import dotenv from 'dotenv'

dotenv.config()

const degreesToRadians = degrees => {
  return (degrees * Math.PI) / 180
}

const downloadAsCSV = async () => {
  // First check if we already have the CSV file
  if (fs.existsSync(`./temp/${process.env.DB_TABLE}.csv`)) {
    return
  }

  const client = await pool.connect()
  const columns = process.env.DB_COLUMNS
  const tableName = process.env.DB_TABLE

  fs.mkdirSync(`./temp`, { recursive: true })

  const queryTemplate = fs.readFileSync('./queries/generateCSV.sql', 'utf8')
  const query = queryTemplate
    .replace(/{{table_name}}/g, tableName)
    .replace(/{{columns}}/g, columns)

  try {
    const stream = client.query(copyTo(`copy (${query}) TO STDOUT CSV HEADER`))
    await pipeline(stream, fs.createWriteStream(`./temp/${tableName}.csv`))
  } finally {
    client.release()
  }
  await pool.end()
}

const downloadAsGeoJSONCopy = async () => {
  const tableName = process.env.DB_TABLE

  // First check if we already have the GeoJSON file
  if (fs.existsSync(`./temp/${tableName}.geojson`)) {
    return JSON.parse(fs.readFileSync(`./temp/${tableName}.geojson`))
  }

  // If the CSV file doesn't already exist, it will be created
  await downloadAsCSV()

  const queryTemplate = fs.readFileSync('./queries/generateGEOJSON.sql', 'utf8')

  const client = await pool.connect()
  const columns = process.env.DB_COLUMNS

  const query = queryTemplate
    .replace(/{{table_name}}/g, tableName)
    .replace(/{{columns}}/g, columns)

  try {
    const stream = client.query(copyTo(`copy (${query}) TO STDOUT`))
    await pipeline(stream, fs.createWriteStream(`./temp/${tableName}.geojson`))
  } finally {
    client.release()
  }
  await pool.end()
}

const degreesToMVTCoords = (latitude, longitude, zoom) => {
  const latitudeRadians = degreesToRadians(latitude)
  const n = 2 ** zoom
  const xTile = Math.floor(((longitude + 180) / 360) * n)
  const yTile = Math.floor(
    ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * n
  )
  return { x: xTile, y: yTile }
}

const getMVTBounds = (bounds, zoom) => {
  const { x: minX, y: maxY } = degreesToMVTCoords(
    bounds.miny,
    bounds.minx,
    zoom
  )
  const { x: maxX, y: minY } = degreesToMVTCoords(
    bounds.maxy,
    bounds.maxx,
    zoom
  )
  const mvtBounds = { minX, maxX, minY, maxY }
  return mvtBounds
}

export const getLatLngBoundsFromDatabase = async () => {
  const query = `SELECT ST_XMin(extent) AS minx, ST_YMin(extent) AS miny, ST_XMax(extent) AS maxx, ST_YMax(extent) AS maxy FROM (SELECT ST_Extent(ST_Transform(ST_SetSRID(geom, 27700), 4326)) as extent FROM ${process.env.DB_TABLE});`
  const result = await pool.query(query)
  const bounds = result.rows[0]
  return bounds
}

export const downloadAsGeoJSON = async () => {
  const tableName = process.env.DB_TABLE

  // First check if we already have the GeoJSON file
  if (fs.existsSync(`./temp/${tableName}.geojson`)) {
    return JSON.parse(fs.readFileSync(`./temp/${tableName}.geojson`))
  }

  // If the CSV file doesn't already exist, it will be created
  await downloadAsCSV()

  const geoJSONFeatures = []

  const jsonArray = await csvtojson().fromFile(`./temp/${tableName}.csv`)
  jsonArray.forEach(element => {
    if (element.geom) {
      const geometry = wktToGeoJSON(element.geom)
      const feat = {
        type: 'Feature',
        geometry,
        properties: (({ geom, ...o }) => o)(element)
      }
      geoJSONFeatures.push(feat)
    }
  })

  const geoJSONFeatureStrings = geoJSONFeatures.map(feature =>
    JSON.stringify(feature)
  )

  const geoJSONFeaturesString = geoJSONFeatureStrings.join(',')

  const geoJSONString = `{"type": "FeatureCollection", "features": [${geoJSONFeaturesString}]}`

  const geoJSON = {
    type: 'FeatureCollection',
    features: geoJSONFeatures
  }

  fs.writeFileSync(`./temp/${tableName}.geojson`, geoJSONString)
  return geoJSON
}

/**
 * Generate the tiles sequentially using vt-pbf
 */
export const vtPbfSequential = async () => {
  const bounds = await getLatLngBoundsFromDatabase()
  const minZoom = process.env.MIN_ZOOM_LEVEL
  const maxZoom = process.env.MAX_ZOOM_LEVEL

  const geoJSON = await downloadAsGeoJSON()

  const tileIndex = geojsonvt(geoJSON, {
    maxZoom: parseInt(maxZoom),
    debug: 1
  })

  // Loop through to create tiles for each zoom level
  for (let zoom = parseInt(minZoom); zoom <= parseInt(maxZoom); zoom++) {
    // Loop through each zoom level
    for (let zoom = parseInt(minZoom); zoom <= parseInt(maxZoom); zoom++) {
      const mvtBounds = getMVTBounds(bounds, zoom)
      const { minX, maxX, minY, maxY } = mvtBounds

      // Loop through each tile in the zoom level
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const mvt = tileIndex.getTile(zoom, x, y)
          const buff = vtpbf.fromGeojsonVt({ geojsonLayer: mvt })
          fs.writeFileSync(`./tiles/${zoom}/${x}/${y}.mvt`, buff)
        }
      }
    }
  }
}

/**
 * Generate the tiles sequentially using the database
 */
export const databaseSequential = async () => {
  const bounds = await getLatLngBoundsFromDatabase()

  // Use the generateTileFromXYZ.sql file as a query template
  const queryTemplate = fs.readFileSync(
    './queries/generateTileFromZXY.sql',
    'utf8'
  )

  const minZoom = process.env.MIN_ZOOM_LEVEL
  const maxZoom = process.env.MAX_ZOOM_LEVEL

  // Loop through each zoom level
  for (let zoom = parseInt(minZoom); zoom <= parseInt(maxZoom); zoom++) {
    const mvtBounds = getMVTBounds(bounds, zoom)
    const { minX, maxX, minY, maxY } = mvtBounds

    // Loop through each tile in the zoom level
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const query = queryTemplate
          .replace(/{{table_name}}/g, process.env.DB_TABLE)
          .replace(/{{columns}}/g, process.env.DB_COLUMNS)

        const result = await pool.query(query, [zoom, x, y])

        const mvt = result.rows[0].mvt
        const fileName = `./tiles/${zoom}/${x}/${y}.mvt`
        // Create the directory if it doesn't exist
        fs.mkdirSync(`./tiles/${zoom}/${x}`, { recursive: true })
        // Write the MVT to a file
        fs.writeFileSync(fileName, mvt)
      }
    }
  }
}

/**
 * Generate the tiles using Tippecanoe
 */
export const tippecanoeBulk = async () => {
  const minZoom = process.env.MIN_ZOOM_LEVEL
  const maxZoom = process.env.MAX_ZOOM_LEVEL

  await downloadAsGeoJSON()

  const tableName = process.env.DB_TABLE

  // Run tippecanoe to generate the tiles
  tippecanoe([`./temp/${tableName}.geojson`], {
    outputToDirectory: './tiles',
    minimumZoom: minZoom,
    maximumZoom: maxZoom,
    force: true
  })
}
