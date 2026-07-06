import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { serveDir } from './serve.js'

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

/**
 * Thumbnail every LIVE fiddle by screenshotting the ASSEMBLED, served portfolio:
 * one static server for the whole repo, load each fiddle's real (built/static)
 * index.html and screenshot it. Correct for rebased builds + static fiddles, and
 * far faster than spinning a dev server per fiddle. Returns the set of
 * "framework/name" keys that were captured. Progress via onProgress.
 */
export async function captureServed(
  repo: string,
  entries: { framework: string; name: string }[],
  port = 4599,
  onProgress?: (done: number, total: number) => void
): Promise<Set<string>> {
  const done = new Set<string>()
  let pw: any
  try {
    pw = await import('playwright')
  } catch {
    return done // playwright not installed — portfolio falls back to placeholder thumbs
  }
  const server = await serveDir(repo, port).catch(() => null)
  if (!server) return done
  const thumbs = path.join(repo, 'thumbs')
  fs.mkdirSync(thumbs, { recursive: true })
  const browser = await pw.chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 })
    let i = 0
    for (const e of entries) {
      i++
      try {
        await page
          .goto(`http://localhost:${port}/f/${e.framework}/${e.name}/`, { waitUntil: 'networkidle', timeout: 10_000 })
          .catch(() => {})
        await page.waitForTimeout(500)
        await page.screenshot({ path: path.join(thumbs, `${e.framework}__${e.name}.png`) })
        done.add(`${e.framework}/${e.name}`)
      } catch {
        /* skip a fiddle that won't load */
      }
      if (onProgress && i % 20 === 0) onProgress(i, entries.length)
    }
  } finally {
    await browser.close()
    server.close()
  }
  return done
}
