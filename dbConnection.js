import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()
const { Pool } = pg

// Create the connection pool from setting in the .env file
export const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT
})

pool.on('connect', () => {
  console.log('Connected to the database')
})

pool.on('error', err => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})
