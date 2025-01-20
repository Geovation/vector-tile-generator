// All the entry poiints for each method are defined here
import {
  databaseSequential,
  vtPbfSequential,
  tippecanoeBulk
} from './methods.js'

// Read input argument of the method to use
const method = process.argv[2]

const start = new Date()

if (method === 'databaseSequential') {
  await databaseSequential()
}

if (method === 'vtPbfSequential') {
  await vtPbfSequential()
}

if (method === 'tippecanoeBulk') {
  await tippecanoeBulk()
}

const end = new Date()
const time = (end - start) / 1000
console.log(`Time taken: ${time} seconds`)
