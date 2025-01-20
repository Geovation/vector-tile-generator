// All the entry poiints for each method are defined here
import {
  databaseSequential,
  vtPbfSequential,
  tippecanoeBulk
} from './methods.js'

const start = new Date()

// Read input argument of the method to use
const method = process.argv[2]

const runMethod = async methodName => {
  if (methodName === 'databaseSequential') {
    await databaseSequential()
  }

  if (methodName === 'vtPbfSequential') {
    await vtPbfSequential()
  }

  if (methodName === 'tippecanoeBulk') {
    await tippecanoeBulk()
  }
}

await runMethod(method)

process.on('exit', () => {
  const end = new Date()
  const time = (end - start) / 1000
  console.log(`Time taken: ${time} seconds`)
})
