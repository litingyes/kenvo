import { serve } from '@hono/node-server'
import { registerTelemetry } from 'ai'

import { getLogDir, serverLog } from './logging.js'
import { createApp } from './routes.js'
import { LocalFileTelemetry } from './telemetry.js'

registerTelemetry(new LocalFileTelemetry())

const DEFAULT_PORT = 32420
const MAX_PORT_ATTEMPTS = 20

function getDesiredPort(): number {
  const envPort = Number(process.env.AGENT_SERVER_PORT)
  if (!Number.isNaN(envPort) && envPort > 0) {
    return envPort
  }

  const args = process.argv.slice(2)
  const portIndex = args.indexOf('--port')
  if (portIndex !== -1 && args[portIndex + 1]) {
    const parsed = Number(args[portIndex + 1])
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  return DEFAULT_PORT
}

async function tryPort(port: number): Promise<number | null> {
  const app = createApp()
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port }, (info) => {
      console.log(`SERVER_READY port=${info.port}`)
      resolve(info.port)
    })

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        server.close()
        resolve(null)
      } else {
        reject(error)
      }
    })
  })
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset++) {
    const port = await tryPort(startPort + offset)
    if (port !== null) {
      return port
    }
  }

  throw new Error(
    `Could not find an available port between ${startPort} and ${startPort + MAX_PORT_ATTEMPTS - 1}`,
  )
}

async function main() {
  const desiredPort = getDesiredPort()
  const port = await findAvailablePort(desiredPort)
  serverLog('info', 'agent-server started', { port, logDir: getLogDir() })
}

main().catch((error) => {
  serverLog('error', 'failed to start agent server', {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
