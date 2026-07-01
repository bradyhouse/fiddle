import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.map': 'application/json'
}

/** Minimal static file server rooted at `root`. Resolves once it's listening. */
export function serveDir(root: string, port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    try {
      let rel = decodeURIComponent((req.url || '/').split('?')[0])
      if (rel.endsWith('/')) rel += 'index.html'
      const file = path.join(root, rel)
      if (!file.startsWith(root)) {
        res.writeHead(403).end('forbidden') // path traversal guard
        return
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end('not found')
        return
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' })
      fs.createReadStream(file).pipe(res)
    } catch {
      res.writeHead(500).end('error')
    }
  })
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(port, () => resolve(server))
  })
}
