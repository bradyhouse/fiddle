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
  onProgress?: (done: number, total: number) => void,
  base = '/'
): Promise<{ done: Set<string>; broken: Set<string> }> {
  const done = new Set<string>()
  const broken = new Set<string>() // errored AND rendered nothing → demote to source-only
  let pw: any
  try {
    pw = await import('playwright')
  } catch {
    return { done, broken } // playwright not installed — portfolio falls back to placeholder thumbs
  }
  // When the gallery is mounted under a path (publishBase, e.g. /fiddles/), built
  // fiddles bake ABSOLUTE /fiddles/f/… refs — so serve the repo's PARENT tree and
  // load pages at the mount path, exactly like production. Requires the repo dir's
  // trailing path to spell the mount (…/site/fiddles ↔ /fiddles/) — else fall back
  // to root-serving with a warning (thumbnails of built fiddles may 404 assets).
  let serveRoot = repo
  if (base !== '/') {
    const segs = base.split('/').filter(Boolean)
    let root = repo
    let ok = true
    for (let i = segs.length - 1; i >= 0; i--) {
      if (path.basename(root) !== segs[i]) {
        ok = false
        break
      }
      root = path.dirname(root)
    }
    if (ok) serveRoot = root
    else console.warn(`  ! publishBase ${base} doesn't match ${repo} — screenshotting root-served (assets may 404)`)
  }
  const urlBase = serveRoot === repo ? '/' : base
  const server = await serveDir(serveRoot, port).catch(() => null)
  if (!server) return { done, broken }
  const thumbs = path.join(repo, 'thumbs')
  fs.mkdirSync(thumbs, { recursive: true })
  const browser = await pw.chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 })
    let errored = false
    page.on('pageerror', () => {
      errored = true
    })
    let i = 0
    for (const e of entries) {
      i++
      errored = false
      try {
        await page
          .goto(`http://localhost:${port}${urlBase}f/${e.framework}/${e.name}/`, { waitUntil: 'networkidle', timeout: 10_000 })
          .catch(() => {})
        // networkidle fires when the last request settles, but canvas/WebGL demos (fabric
        // image clouds, three.js scenes) then fetch textures and paint on the next frames.
        // 500ms caught them mid-blank; 1500ms lets the first draw land in the thumbnail.
        await page.waitForTimeout(1500)
        await page.screenshot({ path: path.join(thumbs, `${e.framework}__${e.name}.png`) })
        done.add(`${e.framework}/${e.name}`)
        // Broken-live detection: an uncaught error AND a truly empty render (no text/svg/img/
        // canvas) → the portfolio demotes it to a browsable source-only card (no dead thumbnail).
        // Conservative on purpose — a sparse-but-working demo, or one that only logs an error, stays live.
        const empty = await page
          .evaluate(() => {
            const txt = (document.body?.innerText || '').trim().length
            const svg = document.querySelectorAll('svg *').length
            const img = [...document.querySelectorAll('img')].filter((i) => (i as HTMLImageElement).naturalWidth > 0).length
            const canvas = document.querySelectorAll('canvas').length
            return txt < 10 && svg === 0 && img === 0 && canvas === 0
          })
          .catch(() => false)
        if (errored && empty) broken.add(`${e.framework}/${e.name}`)
      } catch {
        /* skip a fiddle that won't load */
      }
      if (onProgress && i % 20 === 0) onProgress(i, entries.length)
    }
  } finally {
    await browser.close()
    server.close()
  }
  return { done, broken }
}
