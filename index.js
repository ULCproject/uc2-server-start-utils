// const path = require('path')
const { promisify } = require('util')
const request = promisify(require('request'))
const { spawn } = require('child_process')

const binaryPath = process.env.SERVER_BIN
const localAddr = '127.0.0.1'
let pipeStdout = false
let runningServers = []

async function startServer (port) {
  let server
  try {
    if (binaryPath) {
      server = spawn(binaryPath, [port, localAddr])
    } else {
      server = spawn('node', ['./server.js', port, localAddr])
      runningServers.push(server)
    }
  } catch (e) {
    throw new Error(e)
  }
  server.port = port
  if (pipeStdout) {
    server.stdout.on('data', (chunck) => {
      console.log(`[port ${port} stdout:] ${chunck.toString()}`)
    })
  }
  await sleep(100)
  console.log(`Server on port [${port}] is up!`)
  return server
}

async function startServers (initialPort, num, debug = false) {
  initialPort = Number(initialPort)
  console.log(`Starting ${num} nodes from port ${initialPort}...`)
  pipeStdout = process.env.DEBUG || debug
  let server
  for (let i = 0; i < num; i++) {
    d1 = Date.now()
    server = await startServer(initialPort++)
    d2 = Date.now()
    console.log(`Server ${initialPort-1} has taken ${d2-d1} to comes up`)
  }
  await sleep(3500)
  // checking if the servers were started correctly
  for (let i = 0; i < runningServers.length; i++) {
    try {
      await getJson(`http://${localAddr}:${runningServers[i].port}/nodes`)
    } catch (e) {
      throw new Error('Some servers did not start correctly')
    }
  }
  return runningServers
}

async function resetPort (port) {
  let server = runningServers.find(server => server.port === port)
  if (server) {
    try {
      await request({method: 'POST', url: `http://${localAddr}:${port}/reset`})
      console.log(`Reset server on port ${port}`)
    } catch (e) {
      console.log(`Failed to reset server on port ${port}`)
    }
  }
}

async function restartPort (port) {
  let server = runningServers.find(server => server.port === port)
  if (server) {
    await stopPort(port)
    server = await startServer(port)
    server.port = port
    console.log(`Restart server on port ${port}`)
  } else {
    server = await startServer(port)
  }
}

async function stopPort (port) {
  let i = runningServers.findIndex(server => server.port === port)
  let server = runningServers[i]
  if (server) {
    try {
      await request({method: 'POST', url: `http://${localAddr}:${port}/stop`})
      await server.kill()
      runningServers.splice(i, 1)
      console.log(`Stopped server  on port ${port}`)
    } catch (e) {
      console.log(`Failed to reset server on port ${port}`)
    }
  } else {
    console.log(`Could not find server on port ${port}`)
  }
  await sleep(100)
}

async function resetAll () {
  console.log('Reseting all servers...')
  let requestAll = []
  for (let i = 0; i < runningServers.length; i++) {
    requestAll.push(request({method: 'POST', url: `http://${localAddr}:${runningServers[i].port}/reset`}))
  }
  await Promise.all(requestAll)
  console.log('All servers reset!')
}

async function restartAll (initialPort, num, debug = false) {
  await stopAll()
  runningServers = []
  await startServers(initialPort, num, debug)
}

async function stopAll () {
  console.log('Stopping all servers...')
  for (let i = 0; i < runningServers.length; i++) {
    await request({method: 'POST', url: `http://${localAddr}:${runningServers[i].port}/stop`})
    runningServers[i].kill()
  }
  runningServers = []
  console.log('All servers stoped...')
}

async function sleep (ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function serverIsListening (port) {
  for (let i = 0; i < 30; i++) {
    try {
      await getJson(`http://${localAddr}:${port}/nodes`)
      return true
    } catch (e) {
      console.log('e.message: ' + e.message)
      // request failed, wait for server to be ready
    }
  }
}

function getJson (host) {
  return request({ method: 'GET', url: host, json: true })
}

exports.startServer = startServer
exports.startServers = startServers
exports.resetAll = resetAll
exports.resetOnPort = resetPort
exports.stopAll = stopAll
exports.stopOnPort = stopPort
exports.restartAll = restartAll
exports.restartOnPort = restartPort
