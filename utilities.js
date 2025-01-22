import fs from 'fs'

import dotenv from 'dotenv'
dotenv.config()

import csvtojson from 'csvtojson'
import { to as copyTo } from 'pg-copy-streams'
import { pipeline } from 'node:stream/promises'
import { wktToGeoJSON } from '@terraformer/wkt'
import ogr2ogr from 'ogr2ogr'

import { pool } from './dbConnection.js'

import path from 'path'
import json from 'big-json'
import { table } from 'node:console'

/**
 * Converts degrees to radians
 * @param {*} degrees - degrees to be converted to radians
 * @returns - the value of degrees in radians
 */
export const degreesToRadians = degrees => {
  return (degrees * Math.PI) / 180
}

/**
 * Converts degrees to MVT x and y values
 * @param {*} radians - radians to be converted to degrees
 * @returns - the value of radians in degrees
 * */
export const degreesToMVTCoords = (latitude, longitude, zoom) => {
  const latitudeRadians = degreesToRadians(latitude)
  const n = 2 ** zoom
  const xTile = Math.floor(((longitude + 180) / 360) * n)
  const yTile = Math.floor(
    ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * n
  )
  return { x: xTile, y: yTile }
}

/**
 * Gets the MVT bounds for a given set of bounds and zoom level
 * @param {*} bounds - the bounds to be converted to MVT bounds
 * @param {*} zoom - the zoom level to be used in the conversion
 * @returns - the MVT bounds
 * */
export const getMVTBounds = (bounds, zoom) => {
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
  const query = `SELECT ST_XMin(extent) AS minx, ST_YMin(extent) AS miny, ST_XMax(extent) AS maxx, ST_YMax(extent) AS maxy FROM (SELECT ST_Extent(ST_Transform(geom, 4326)) as extent FROM ${process.env.DB_TABLE});`
  const result = await pool.query(query)
  const bounds = result.rows[0]
  return bounds
}

export const downloadDBTableCSV = async () => {
  // First check if we already have the CSV file
  if (fs.existsSync(`./temp/${process.env.DB_TABLE}.csv`)) return

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
  return
}

export const readGeoJSON = async () => {
  const tableName = process.env.DB_TABLE
  const readStream = fs.createReadStream(`./temp/${tableName}.geojson`)
  const parseStream = json.createParseStream()

  const geoJSON = await new Promise((resolve, reject) => {
    parseStream.on('data', data => {
      resolve(data)
    })
    readStream.pipe(parseStream)
  })

  return geoJSON
}

export const csvToGeoJSON = async (returnGeoJSON = false) => {
  const tableName = process.env.DB_TABLE

  // First check if we already have the GeoJSON file
  if (fs.existsSync(`./temp/${tableName}.geojson`)) {
    return returnGeoJSON ? readGeoJSON() : null
  }

  // If the CSV file doesn't already exist, it will be created
  await downloadDBTableCSV()

  // Use ogr2ogr to convert the CSV to GeoJSON
  await ogr2ogr(`./temp/${tableName}.csv`, {
    destination: `./temp/${tableName}.geojson`,
    options: [
      '-oo',
      'GEOM_POSSIBLE_NAMES=geom',
      '-oo',
      'KEEP_GEOM_COLUMNS=NO',
      '-oo',
      'MAX_LINE_SIZE=-1'
    ]
  })

  return returnGeoJSON ? readGeoJSON() : null
}

export const downloadAsGeoJSON = async () => {
  const tableName = process.env.DB_TABLE

  // First check if we already have the GeoJSON file
  if (fs.existsSync(`./temp/${tableName}.geojson`)) {
    return JSON.parse(fs.readFileSync(`./temp/${tableName}.geojson`))
  }

  // If the CSV file doesn't already exist, it will be created
  await downloadDBTableCSV()

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
