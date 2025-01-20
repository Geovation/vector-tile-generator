import fs from 'fs'

import geojsonvt from 'geojson-vt'
import tippecanoe from 'tippecanoe'
import vtpbf from 'vt-pbf'

import dotenv from 'dotenv'
dotenv.config()

import { pool } from './dbConnection.js'

import {
  getLatLngBoundsFromDatabase,
  downloadAsGeoJSON,
  getMVTBounds
} from './utilities.js'

/**
 * Generate the tiles sequentially using vt-pbf
 */
export const vtPbfSequential = async () => {
  const bounds = await getLatLngBoundsFromDatabase()
  const minZoom = parseInt(process.env.MIN_ZOOM_LEVEL)
  const maxZoom = parseInt(process.env.MAX_ZOOM_LEVEL)
  const tableName = process.env.DB_TABLE

  const geoJSON = await downloadAsGeoJSON()

  const tileIndex = geojsonvt(geoJSON, {
    maxZoom: parseInt(maxZoom),
    debug: 1
  })

  // Loop through to create tiles for each zoom level
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    // Loop through each zoom level
    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
      const mvtBounds = getMVTBounds(bounds, zoom)
      const { minX, maxX, minY, maxY } = mvtBounds

      // Loop through each tile in the zoom level
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const mvt = tileIndex.getTile(zoom, x, y)
          if (!mvt) continue
          // Create the directory if it doesn't exist
          fs.mkdirSync(`./tiles/${zoom}/${x}`, { recursive: true })
          const buff = vtpbf.fromGeojsonVt({ [tableName]: mvt })
          fs.writeFileSync(`./tiles/${zoom}/${x}/${y}.mvt`, 'utf8', buff)
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
  const minZoom = parseInt(process.env.MIN_ZOOM_LEVEL)
  const maxZoom = parseInt(process.env.MAX_ZOOM_LEVEL)

  // Use the generateTileFromXYZ.sql file as a query template
  const queryTemplate = fs.readFileSync(
    './queries/generateTileFromZXY.sql',
    'utf8'
  )

  // Loop through each zoom level
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
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
 * Generate the tiles in bulk using Tippecanoe
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
