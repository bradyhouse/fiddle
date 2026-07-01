// Files injected into every (browser) fiddle on create/fork.

export const PLAYWRIGHT_CONFIG = `import { defineConfig } from '@playwright/test'

// Auto-starts the dev server and points tests at it. \`npm test\` just works.
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000
  }
})
`

export const SMOKE_SPEC = `import { test, expect } from '@playwright/test'

test('fiddle loads and renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
  // fiddle publish reuses this shot for the portfolio thumbnail
  await page.screenshot({ path: 'tests/screenshot.png', fullPage: true })
})
`

export const claudeMd = (framework: string, name: string): string => `# ${name}

A **${framework}** fiddle — a throwaway sandbox for exploring one idea, scaffolded and
managed with [fiddle](https://github.com/bradyhouse/fiddle).

## Run it
\`\`\`bash
fiddle start ${framework} ${name}     # or, from here: npm run dev
\`\`\`

## Test / screenshot it
Playwright is pre-configured and auto-starts the dev server:
\`\`\`bash
npx playwright install    # one-time: download browsers
npm test                  # runs tests/smoke.spec.ts → writes tests/screenshot.png
\`\`\`

## Notes for Claude
- This is a **single-purpose sandbox** — keep changes scoped to this fiddle.
- \`fiddle publish\` builds it and integrates it into the portfolio **automatically**
  (auto-nav + the screenshot above as its thumbnail). Do **not** hand-wire portfolio
  plumbing in here.
- Iterate by \`fiddle fork ${framework} ${name}\` rather than editing a "known-good" fiddle.
`
