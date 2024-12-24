import { databaseSequential, geoJSONSequential } from './methods.js'

// Read input argument of the method to use
const method = process.argv[2]

console.log('Executing method:', method)

// Execute the method
if (method === 'databaseSequential') {
  await databaseSequential()
}

if (method === 'geoJSONSequential') {
  await geoJSONSequential()
}
