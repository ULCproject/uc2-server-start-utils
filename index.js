// const path = require('path')
const { promisify } = require('util')
const request = promisify(require('request'))
const { spawn } = require('child_process')

const BINARY_PATH = process.env.SERVER_BIN
const LOCAL_ADDRESS = '127.0.0.1'
const NODE_UP_TIMEOUT = 5000 // how long to wait for nodes to stand up

let runningServers = []

function getJson (host) {
  return request({ method: 'GET', url: host, json: true })
}

async function sleep (ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// this will hold up flow control until the host either
// makes a successful fetch (if available is set to true) or
// a failed fetch (if available is set to false). Once
// the condition is met, it returns either true if it was a success,
// or false if it timed out.
const awaitCondition = async (host, available = true) => {
  const startTime = new Date().valueOf()

  let success = true

  while (true) {
    if (new Date().valueOf() - startTime > NODE_UP_TIMEOUT) {
      // The condition timed out
      success = false
      break
    }

    // try the condition
    try {
      await getJson(host)
      if (available) break
    } catch (e) {
      if (!available) break
    }

    // arbitrary number, minimally relevant. How long between polls.
    await sleep(500)
  }

  return success
}

async function startServer (port, debug = false) {
  let server

  if (BINARY_PATH) server = spawn(BINARY_PATH, [port, LOCAL_ADDRESS])
  else             server = spawn('node', ['./server.js', port, LOCAL_ADDRESS])

  const success = await awaitCondition(`http://${LOCAL_ADDRESS}:${port}/nodes`)

  if (!success) throw new Error(`Server at port ${port} failed to start.`)

  server.port = port

  if (debug) {
    server.stdout.on('data', (chunck) => {
      console.log(`[port ${port} stdout:] ${chunck.toString()}`)
    })
  }

  runningServers.push(server)

  console.log('Successfully started server on port', port)

  return server
}

async function startServers (initialPort, num, waitTime = 3500, debug = false) {
  initialPort = Number(initialPort)

  console.log(`Starting ${num} nodes from port ${initialPort}...`)

  await startServer(initialPort, debug)

  let promises = []

  for (let i = 1; i < num; i++) {
    promises.push(startServer(initialPort + i, debug))
  }

  try {
    await Promise.all(promises)
  } catch (e) {
    console.log(e)
  }

  await sleep(waitTime)

  return runningServers
}

async function restartOnPort (port, debug = false) {
  let server = runningServers.find(server => server.port === port)

  if (!server) return server = await startServer(port, debug)

  await stopOnPort(port)
  server = await startServer(port, debug)

  console.log(`Restart server on port ${port}`)
}

async function stopOnPort (port) {
  const serverIndex = runningServers.findIndex(server => server.port === port)

  const server = runningServers[serverIndex]

  if (!server) return console.log(`Could not find server on port ${port}`)

  server.kill()

  const success = await awaitCondition(`http://${LOCAL_ADDRESS}:${port}/nodes`, false)

  if (!success) throw new Error(`Failed to stop server on port ${port}`)

  runningServers.splice(serverIndex, 1)

  console.log('Stopped server on port', port)
}

async function resetOnPort (port) {
  let server = runningServers.find(server => server.port === port)

  if (!server) return

  await request({method: 'POST', url: `http://${LOCAL_ADDRESS}:${port}/reset`})
    .then(() => console.log(`Reset server on port ${port}`))
    .catch(() => console.log(`Failed to reset server on port ${port}`))
}

async function resetAll () {
  console.log('Reseting all servers...')

  const requestAll = runningServers.map(server => resetOnPort(server.port))

  await Promise.all(requestAll)

  console.log('All servers reset!')
}

async function restartServer (server, debug = false) {
  await stopOnPort(server.port)
  await startServer(server.port, debug)
}

async function restartAll (debug = false) {
  const promises = runningServers.map(server => restartServer(server))
  await Promise.all(promises)
}

async function stopAll () {
  console.log('Stopping all servers...')

  const promises = runningServers.map(server => stopOnPort(server.port))

  await Promise.all(promises)

  runningServers = []
}

exports.runningServers = runningServers
exports.startServer = startServer
exports.startServers = startServers
exports.resetAll = resetAll
exports.resetOnPort = resetOnPort
exports.stopAll = stopAll
exports.stopOnPort = stopOnPort
exports.restartAll = restartAll
exports.restartOnPort = restartOnPort
