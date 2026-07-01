import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'

const PORT = 5199

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1')
    sock.on('connect', () => {
      sock.destroy()
      resolve(true)
    })
    sock.on('error', () => resolve(false))
  })
}

async function waitForPort(port: number, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(port)) return true
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

/**
 * Best-effort thumbnail: start the fiddle's dev server, screenshot it, tear down.
 * Returns false (no throw) if Playwright/browsers aren't installed — screenshots
 * are optional; the portfolio just falls back to a placeholder thumbnail.
 */
export async function captureFiddle(dir: string, out: string): Promise<boolean> {
  let pw: any
  try {
    pw = await import('playwright')
  } catch {
    return false // playwright not installed
  }

  let server: ChildProcess | undefined
  try {
    server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
      cwd: dir,
      stdio: 'ignore',
      detached: true
    })
    if (!(await waitForPort(PORT))) return false

    const browser = await pw.chromium.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 })
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {})
      await page.waitForTimeout(1500)
      await page.screenshot({ path: out })
      return true
    } finally {
      await browser.close()
    }
  } catch {
    return false
  } finally {
    if (server?.pid) {
      try {
        process.kill(-server.pid, 'SIGKILL') // kill the dev-server process group
      } catch {
        server.kill('SIGKILL')
      }
    }
  }
}
