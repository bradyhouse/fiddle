// Parse a fiddle's README into portfolio metadata. Nearly every fiddle in a
// fiddle.sh-era collection carries a structured README (### Title / ### Creation
// Date / ### Description / ### Tags / ### Forked From / ### Published Version
// Link) — the README is the source of truth for "what is this?", so it's parsed
// at ASSEMBLE time rather than duplicated into .fiddle.json. A `description` in
// .fiddle.json, when present, overrides the parsed one (escape hatch for fiddles
// whose README is scaffolder boilerplate).

import fs from 'node:fs'
import path from 'node:path'

export interface FiddleMeta {
  title: string // "### Title" — display name ("2 Quadrant Bar Chart")
  desc: string // "### Description" (or first real paragraph), plaintext, ≤600 chars
  date: string // "### Creation Date" as written (formats vary across a decade)
  tags: string[] // "### Tags", split + trimmed, capped
  fork: string // "### Forked From" fiddle dir name (fiddle-NNNN-Foo) — same framework
  pen: string // "### Published Version Link" first URL (codepen/jsfiddle/…)
}

const README_NAMES = ['README.md', 'README.markdown', 'readme.md', 'readme.markdown']
const MAX_DESC = 600
const MAX_TAGS = 12

/** Strip markdown noise down to plain text: images/comments/tags gone, links → their text. */
function plainText(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments (the create-template's Description hint)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
    .replace(/<[^>\n]+>/g, ' ') // raw HTML (sized <img>s etc. are common in old READMEs)
    .replace(/^[=-]{3,}\s*$/gm, '') // setext underlines
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // bold/italic
    .replace(/`([^`]+)`/g, '$1') // code spans
    .replace(/(^|\W)_{1,3}([^_]+)_{1,3}(?=\W|$)/g, '$1$2') // _emphasis_ — but not snake_case
    .replace(/\s+/g, ' ')
    .trim()
}

/** Grab the body of a `### <name>` section (up to the next heading). */
function section(md: string, name: string): string {
  // Body = the following lines that are NOT headings, matched line-by-line — a lazy
  // [\s\S]*? with an end-lookahead lets an EMPTY section swallow the next heading
  // (its `\n+` eats the newline the lookahead needs), so headings are excluded per line.
  const m = md.match(new RegExp(`^#{2,4}\\s*${name}\\s*$((?:\\n(?!#{1,6}\\s).*)*)`, 'im'))
  return m ? m[1].trim() : ''
}

/** True for placeholder bodies: "n/a", "tbd", "...", the fiddle's own dir name. */
function isPlaceholder(text: string, fiddleName: string): boolean {
  const t = text.trim().toLowerCase()
  return !t || t.length < 12 || /^(n\/?a|tbd|todo|\.{3})\.?$/.test(t) || t === fiddleName.toLowerCase()
}

/**
 * Fallback for unstructured READMEs (delegate-scaffolder boilerplate, hand-written
 * ones): the first paragraph that reads like prose — skipping headings, images,
 * badges, code fences, and lines that just repeat the fiddle's name.
 */
function firstParagraph(md: string, fiddleName: string): string {
  const paras = md.split(/\n\s*\n/)
  for (const p of paras) {
    const line = p.trim()
    if (!line || /^#|^```|^=+$|^-+$|^\||^</.test(line)) continue
    if (/\n[=-]{3,}\s*$/.test(line)) continue // setext heading: "Title\n======" is one paragraph
    if (/^!\[|^\[!\[/.test(line)) continue // images / badge rows
    const txt = plainText(line)
    if (isPlaceholder(txt, fiddleName)) continue
    if (/^fiddle-\d+-/.test(txt)) continue // name/date header block, not prose
    if (txt.split(' ').length < 4) continue // too short to explain anything
    return txt
  }
  return ''
}

/**
 * Read a fiddle dir's README (+ optional .fiddle.json `description` override)
 * into FiddleMeta. Returns null when there's nothing useful to show.
 */
export function readFiddleMeta(dir: string): FiddleMeta | null {
  const fiddleName = path.basename(dir)
  const readmePath = README_NAMES.map((n) => path.join(dir, n)).find((p) => fs.existsSync(p))
  let md = ''
  try {
    if (readmePath) md = fs.readFileSync(readmePath, 'utf8')
  } catch {
    /* unreadable readme — treat as absent */
  }

  let title = plainText(section(md, 'Title'))
  // A title that's just the dir name (or another fiddle-NNNN-… string) is noise —
  // the shell's humanizer renders the dir name better than the raw echo. Prose-length
  // "titles" (real READMEs put paragraphs there) aren't titles either.
  if (/^fiddle-\d+-/i.test(title) || title.length > 80) title = ''
  let desc = plainText(section(md, 'Description'))
  if (isPlaceholder(desc, fiddleName)) desc = firstParagraph(md, fiddleName)
  if (desc && desc === title) desc = '' // fresh-template READMEs: don't echo the title as the desc
  const date = plainText(section(md, 'Creation Date'))
  const tags = section(md, 'Tags')
    .split(/[,;\n]/)
    .map((t) => plainText(t).replace(/^[-*+•]\s*/, '')) // bullet-list tags keep their markers otherwise
    .filter((t) => t && t.length <= 40)
    .slice(0, MAX_TAGS)
  // Slugs may be hyphenated (fiddle-0100-my-cool-thing) — and must not capture a
  // trailing sentence period, so the char class allows [-.] but the name ends on \w.
  const fork = section(md, 'Forked From').match(/fiddle-\d+-[\w.-]*\w/i)?.[0] ?? ''
  const pen = section(md, 'Published Version Link').match(/https?:\/\/[^\s)"'>]+/)?.[0] ?? ''

  // .fiddle.json `description` override — for fiddles whose README is boilerplate.
  try {
    const fj = JSON.parse(fs.readFileSync(path.join(dir, '.fiddle.json'), 'utf8'))
    if (typeof fj.description === 'string' && fj.description.trim()) desc = fj.description.trim()
  } catch {
    /* no .fiddle.json / no override */
  }

  if (desc.length > MAX_DESC) desc = desc.slice(0, MAX_DESC - 1).replace(/\s+\S*$/, '') + '…'
  if (!title && !desc && !tags.length && !fork && !pen) return null // nothing worth shipping
  return { title, desc, date, tags, fork, pen }
}
