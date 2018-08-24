# uc2-server-start-utils

Provides a library to simplify starting UC2 servers for testing.

```JS
startServer(port)                                                    //starts one node ate the given port
startServers(initialPort, numberOfServers)  //starts <numberOfServer> nodes starting from the port <initialPort>
resetAll()                                                                 // Resets all nodes
resetOnPort(port)                                                // Resets the <port> node
stopAll()                                                                  // Stops all nodes (kills the process)
stopOnPort()                                                         // Stops the <port> node (kills it)
restartAll(initialPort, numberOfServers)      // Kills all the nodes and start them again
restartOnPort(port)                                             // Kills and start again the <port> server
```

If you have the `SERVER_BIN` env variable configured, it'll run that binary, otherwise it'll look for your `server.js`.

The `startServers()` and `restartAll()` functions have a 3rd attribute, a flag that shows all your subprocess stdout on the prompt.

_NOTE: If you need to `stopOnePort()` or `stopAll()` make sure you either `restartOnPort()` or `restartAll()` (reset methods won't bring the processe alive again)_
