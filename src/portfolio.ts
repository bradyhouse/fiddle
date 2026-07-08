// The auto-generated portfolio: a manifest of the collection + a Storybook-like
// shell (sidebar nav grouped by framework → each fiddle in an iframe pane).
// Phosphor/CRT aesthetic. Self-contained — deploys to any static host.

import type { FiddleMeta } from './readme-meta.js'

export interface ManifestEntry {
  framework: string
  name: string // fiddle-0001-foo
  friendly: string // foo
  url: string // f/<framework>/<name>/index.html
  thumb: string | null // thumbs/<framework>__<name>.png
  live: boolean // false = source-only (no runnable demo; opens straight to code)
  files: string[] // source files, relative to the fiddle dir (for the source view)
  // README-derived metadata (see readme-meta.ts) — the "what is this?" layer.
  // Optional: fields are omitted from the manifest when empty to keep it lean.
  title?: string // "### Title" display name
  desc?: string // "### Description" plaintext
  date?: string // "### Creation Date"
  tags?: string[] // "### Tags"
  fork?: string // "### Forked From" fiddle name (same framework) — lineage deep-link
  pen?: string // "### Published Version Link" (codepen/jsfiddle/…)
}

export function buildManifest(
  items: {
    framework: string
    name: string
    friendly: string
    hasThumb: boolean
    live?: boolean
    files?: string[]
    meta?: FiddleMeta | null
  }[]
): ManifestEntry[] {
  return items
    .map((i) => ({
      framework: i.framework,
      name: i.name,
      friendly: i.friendly,
      url: `f/${i.framework}/${i.name}/`, // the DIRECTORY, not index.html — so SPA routers (vue-router) match their home route instead of falling to a 404 on "/index.html"
      thumb: i.hasThumb ? `thumbs/${i.framework}__${i.name}.png` : null,
      live: i.live !== false,
      files: i.files ?? [],
      ...(i.meta?.title ? { title: i.meta.title } : {}),
      ...(i.meta?.desc ? { desc: i.meta.desc } : {}),
      ...(i.meta?.date ? { date: i.meta.date } : {}),
      ...(i.meta?.tags?.length ? { tags: i.meta.tags } : {}),
      ...(i.meta?.fork ? { fork: i.meta.fork } : {}),
      ...(i.meta?.pen ? { pen: i.meta.pen } : {})
    }))
    .sort((a, b) => a.framework.localeCompare(b.framework) || a.name.localeCompare(b.name))
}

export function shellHtml(manifest: ManifestEntry[], title = 'fiddles', favorite = '', homeUrl = ''): string {
  // README-derived text is user-authored: escape `<` so a description containing
  // "</script>" can't terminate the inline script element (JSON.stringify doesn't).
  const DATA = JSON.stringify(manifest).replace(/</g, '\\u003c')
  // Optional "← home" link (config `homeUrl`) — set when the gallery is nested under a parent
  // site (e.g. `../`); omitted for standalone `fiddle preview`. Escaped for the HTML attribute.
  const homeLink = homeUrl
    ? `<a class="home" href="${homeUrl.replace(/"/g, '&quot;')}">← home</a>`
    : ''
  // The landing fiddle (config `favorite`, as "<framework>/<name>"). Only honored if it
  // matches a real entry — otherwise the shell falls back to the "select a fiddle" prompt.
  const FAV = JSON.stringify(favorite && manifest.some((m) => `${m.framework}/${m.name}` === favorite) ? favorite : '').replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Brady House</title>
<style>
  :root{--phos:#33ff33;--phos-dim:#1f9d1f;--cursor:#80ff80;--phos-bg:#060d06;--ink:#080c08;
    --panel:#0f160f;--panel-2:#131c13;--line:#1d2a1d;--text:#d7e6d7;--muted:#7f947f;
    --mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{background:var(--ink);color:var(--text);font-family:var(--sans);display:grid;grid-template-columns:300px 1fr;grid-template-rows:auto 1fr;height:100vh;overflow:hidden}
  /* header */
  header{grid-column:1/-1;background:var(--phos-bg);border-bottom:1px solid var(--line);position:relative;overflow:hidden;padding:14px 20px;font-family:var(--mono);display:flex;align-items:center;justify-content:space-between;gap:16px}
  header::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0,rgba(0,0,0,.2) 1px,transparent 1px,transparent 3px);opacity:.6}
  header h1{position:relative;color:var(--phos);font-size:15px;font-weight:700;letter-spacing:.02em;text-shadow:0 0 7px rgba(51,255,51,.5)}
  header h1 .dim{color:var(--phos-dim);font-weight:400}
  header .home{position:relative;flex:none;color:var(--phos-dim);text-decoration:none;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:5px 11px;transition:.12s}
  header .home:hover{color:var(--phos);border-color:var(--phos-dim);text-shadow:0 0 6px rgba(51,255,51,.5)}
  /* sidebar */
  aside{border-right:1px solid var(--line);overflow-y:auto;padding:12px}
  .search{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--text);
    font-family:var(--mono);font-size:12px;padding:8px 10px;margin-bottom:10px;outline:none}
  .search:focus{border-color:var(--phos-dim)}
  .fw-header{display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:pointer;user-select:none;
    font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:6px 8px;margin:1px 0;border-radius:6px}
  .fw-header:hover{background:var(--panel-2);color:var(--phos)}
  .fw-header .chev{display:inline-block;font-size:8px;transition:transform .15s;color:var(--phos-dim)}
  .fw-group.open>.fw-header{color:var(--phos-dim)}
  .fw-group.open>.fw-header .chev{transform:rotate(90deg)}
  .fw-header .cnt{color:var(--muted);font-size:10px}
  .fw-items{display:none;margin:0 0 6px 8px}
  .fw-group.open>.fw-items{display:block}
  .item{display:flex;gap:9px;align-items:center;padding:6px 8px;border-radius:8px;cursor:pointer;border:1px solid transparent;transition:.12s}
  .item:hover{background:var(--panel-2);border-color:var(--line)}
  .item.active{background:var(--panel-2);border-color:var(--phos-dim)}
  .item .thumb{width:44px;height:30px;border-radius:4px;background:#05080c center/cover no-repeat;border:1px solid var(--line);flex:none}
  .item .lbl{font-size:12.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .item.active .lbl{color:var(--phos)}
  /* stage */
  main{position:relative;display:flex;flex-direction:column;min-width:0}
  .bar{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12px;color:var(--muted)}
  .bar .cur{color:var(--phos)}
  .toggle{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--phos-dim);background:transparent;border:1px solid var(--line);border-radius:6px;padding:4px 9px;cursor:pointer}
  .toggle:hover{color:var(--phos);border-color:var(--phos-dim)}
  .bar a{color:var(--phos-dim);text-decoration:none}.bar a:hover{color:var(--phos)}
  /* README info card — the "what is this?" layer (parsed from each fiddle's README) */
  .info{display:none;border-bottom:1px solid var(--line);background:var(--phos-bg);padding:10px 16px;font-family:var(--mono);max-height:138px;overflow-y:auto;position:relative}
  .info::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0,rgba(0,0,0,.14) 1px,transparent 1px,transparent 3px);opacity:.5}
  .info>*{position:relative}
  .info .desc{color:var(--text);font-size:12px;line-height:1.55}
  .info .d{color:var(--muted);font-size:10.5px;white-space:nowrap}
  .info .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;align-items:center}
  .info .tag{font-size:10px;color:var(--phos-dim);border:1px solid var(--line);border-radius:999px;padding:2px 8px;white-space:nowrap}
  .info a{color:var(--phos-dim);text-decoration:none;font-size:11px;border:1px solid var(--line);border-radius:6px;padding:2px 8px}
  .info a:hover{color:var(--phos);border-color:var(--phos-dim)}
  .info::-webkit-scrollbar{width:8px}.info::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px}
  .stage{flex:1;min-height:0;position:relative;padding:22px;background:radial-gradient(130% 90% at 50% 0%,#0d150d 0%,var(--ink) 72%)}
  .stage iframe{width:100%;height:100%;border:1px solid var(--line);border-radius:10px;background:#fff;box-shadow:0 0 0 1px rgba(51,255,51,.05),0 20px 55px rgba(0,0,0,.55)}
  .code{display:none;position:absolute;inset:22px;flex-direction:column;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel);box-shadow:0 20px 55px rgba(0,0,0,.55)}
  .tabs{display:flex;gap:2px;overflow-x:auto;background:var(--phos-bg);border-bottom:1px solid var(--line);padding:6px 6px 0;flex:none}
  .tabs::-webkit-scrollbar{height:0}
  .tab{font-family:var(--mono);font-size:11px;color:var(--muted);background:transparent;border:1px solid transparent;border-bottom:none;border-radius:6px 6px 0 0;padding:6px 10px;cursor:pointer;white-space:nowrap}
  .tab:hover{color:var(--phos)}
  .tab.active{color:var(--phos);background:var(--panel);border-color:var(--line)}
  .code pre{margin:0;flex:1;overflow:auto;padding:16px 18px;font-family:var(--mono);font-size:12.5px;line-height:1.55;color:var(--text);white-space:pre;tab-size:2}
  .empty{flex:1;display:grid;place-items:center;color:var(--muted);font-family:var(--mono);font-size:13px}
  aside::-webkit-scrollbar{width:8px}aside::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px}
</style>
</head>
<body>
  <header><h1>brady@house<span class="dim">:~/</span>fiddles<span class="dim"> — a decade of build-to-learn</span></h1>${homeLink}</header>
  <aside>
    <input class="search" placeholder="search framework or fiddle…" oninput="render(this.value)">
    <div id="nav"></div>
  </aside>
  <main>
    <div class="bar">
      <span class="cur" id="cur">—</span>
      <button class="toggle" id="codeBtn" onclick="toggleCode()" style="display:none">&lt;/&gt; source</button>
      <a id="pop" href="#" target="_blank" style="display:none">open ↗</a>
    </div>
    <div class="info" id="info"></div>
    <div class="empty" id="empty">select a fiddle from the left</div>
    <div class="stage" id="stage" style="display:none">
      <iframe id="frame"></iframe>
      <div class="code" id="code"><div class="tabs" id="tabs"></div><pre id="src"></pre></div>
    </div>
  </main>
<script>
  const FIDDLES = ${DATA};
  const FAVORITE = ${FAV};
  // Prettify a fiddle name for display: SelectAppend → Select Append,
  // CSVReporter → CSV Reporter, ent_ag-grid → ent ag grid. (Raw name is kept
  // for hashes/links.)
  function humanize(s){
    return String(s)
      .replace(/[-_]+/g,' ')
      .replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2')
      .replace(/([a-z\\d])([A-Z])/g,'$1 $2')
      .replace(/\\s+/g,' ').trim();
  }
  const nav = document.getElementById('nav'), frame = document.getElementById('frame'),
        empty = document.getElementById('empty'), cur = document.getElementById('cur'), pop = document.getElementById('pop'),
        stage = document.getElementById('stage'), code = document.getElementById('code'),
        tabs = document.getElementById('tabs'), src = document.getElementById('src'), codeBtn = document.getElementById('codeBtn'),
        info = document.getElementById('info');
  // README info card — everything set via textContent (never innerHTML) so README
  // content can't inject markup.
  function renderInfo(f){
    info.innerHTML='';
    // No title row — the bar above already reads "framework / Title". The card is
    // the description (full width) plus a meta row: date · tags · lineage · pen.
    if(!(f.desc || (f.tags&&f.tags.length) || f.fork || f.pen)){ info.style.display='none'; return; }
    if(f.desc){ const p=document.createElement('div'); p.className='desc'; p.textContent=f.desc; info.appendChild(p); }
    const meta=document.createElement('div'); meta.className='meta';
    if(f.date){ const d=document.createElement('span'); d.className='d'; d.textContent=f.date; meta.appendChild(d); }
    (f.tags||[]).forEach(function(tg){ const s=document.createElement('span'); s.className='tag'; s.textContent=tg; meta.appendChild(s); });
    if(f.fork){
      const parent=FIDDLES.find(x=>x.framework===f.framework&&x.name===f.fork);
      if(parent){
        const a=document.createElement('a'); a.href='#'+f.framework+'/'+f.fork;
        a.textContent='↳ forked from '+(parent.title||humanize(parent.friendly));
        a.onclick=function(e){ e.preventDefault(); open(parent, document.querySelector('.item[data-key="'+f.framework+'/'+f.fork+'"]')); };
        meta.appendChild(a);
      }
    }
    if(f.pen){ const a=document.createElement('a'); a.href=f.pen; a.target='_blank'; a.rel='noopener'; a.textContent='pen ↗'; meta.appendChild(a); }
    if(meta.children.length) info.appendChild(meta);
    info.style.display='block';
  }
  let current = null, codeOn = false;
  function setView(showCode){
    codeOn = showCode;
    code.style.display = showCode ? 'flex' : 'none';
    frame.style.display = showCode ? 'none' : 'block';
    codeBtn.textContent = showCode ? '▶ preview' : '</> source';
  }
  function open(f, el){
    current = f;
    document.querySelectorAll('.item.active').forEach(e=>e.classList.remove('active'));
    if(el){ el.classList.add('active'); const g=el.closest('.fw-group'); if(g) g.classList.add('open'); el.scrollIntoView({block:'nearest'}); }
    empty.style.display='none'; stage.style.display='block';
    cur.textContent = f.framework + ' / ' + (f.title || humanize(f.friendly));
    renderInfo(f);
    if(f.live !== false){
      setView(false); frame.src=f.url;                 // land on the live demo
      pop.style.display='inline'; pop.href=f.url;
      codeBtn.style.display = (f.files && f.files.length) ? 'inline' : 'none';
    } else {
      frame.src='about:blank';                          // no runnable demo — source only
      setView(true); loadCode(f);
      pop.style.display='none';
      codeBtn.style.display='none';                     // nothing to toggle back to
    }
    location.hash = f.framework + '/' + f.name;
  }
  function toggleCode(){ if(current){ setView(!codeOn); if(codeOn) loadCode(current); } }
  function loadCode(f){
    const base = f.url.replace(/[^/]*$/, '');
    const files = (f.files && f.files.length) ? f.files : ['index.html'];
    tabs.innerHTML=''; src.textContent='loading…';
    files.forEach((fp,i)=>{
      const t=document.createElement('button'); t.className='tab'+(i===0?' active':''); t.textContent=fp;
      t.onclick=()=>{ tabs.querySelectorAll('.tab.active').forEach(x=>x.classList.remove('active')); t.classList.add('active'); fetchFile(base+fp); };
      tabs.appendChild(t);
    });
    fetchFile(base+files[0]);
  }
  async function fetchFile(url){
    try{ const r=await fetch(url); src.textContent = r.ok ? await r.text() : '// '+r.status+' — '+url; }
    catch(e){ src.textContent='// could not load '+url; }
    src.scrollTop=0;
  }
  function itemEl(f){
    const it=document.createElement('div'); it.className='item'; it.dataset.key=f.framework+'/'+f.name;
    const isFav = (f.framework+'/'+f.name) === FAVORITE;
    const star = isFav ? '<span title="landing fiddle" style="margin-left:auto;color:var(--phos);font-size:11px;text-shadow:0 0 6px rgba(51,255,51,.6)">★</span>' : '';
    const tag = (!isFav && f.live===false) ? '<span style="margin-left:auto;color:var(--muted);font-size:9.5px;letter-spacing:.05em">src</span>' : '';
    it.innerHTML='<div class="thumb"'+(f.thumb?' style="background-image:url('+f.thumb+')"':'')+'></div><div class="lbl"></div>'+star+tag;
    it.querySelector('.lbl').textContent = f.title || humanize(f.friendly); // textContent: titles come from READMEs
    if(f.desc) it.title = f.desc; // hover tooltip answers "what is this?" before opening
    it.onclick=()=>open(f,it); return it;
  }
  function render(filter=''){
    filter = filter.trim().toLowerCase();
    const byFw = {};
    // A filter that IS a framework name (the site's #three/#vue chips land here via
    // landOnFramework) means that framework exactly — not every fiddle whose
    // description mentions it.
    const exactFw = filter && FIDDLES.some(f=>f.framework.toLowerCase()===filter);
    for(const f of FIDDLES){
      if(exactFw){ if(f.framework.toLowerCase()!==filter) continue; }
      // Otherwise search the README-derived metadata too: title, description, tags —
      // so "tooltip", "webgl", "tween" find fiddles whose dir name never says so.
      else if(filter && !(f.framework+' '+f.friendly+' '+humanize(f.friendly)+' '+(f.title||'')+' '+(f.desc||'')+' '+((f.tags||[]).join(' '))).toLowerCase().includes(filter)) continue;
      (byFw[f.framework] ||= []).push(f);
    }
    nav.innerHTML='';
    const fws = Object.keys(byFw).sort();
    for(const fw of fws){
      const grp=document.createElement('div'); grp.className='fw-group';
      if(filter || fws.length===1) grp.classList.add('open'); // auto-expand when searching
      const h=document.createElement('div'); h.className='fw-header';
      h.innerHTML='<span><span class="chev">▶</span> '+fw+'</span><span class="cnt">'+byFw[fw].length+'</span>';
      h.onclick=()=>grp.classList.toggle('open');
      grp.appendChild(h);
      const box=document.createElement('div'); box.className='fw-items';
      for(const f of byFw[fw]) box.appendChild(itemEl(f));
      grp.appendChild(box); nav.appendChild(grp);
    }
  }
  render();
  // Land on: (1) a deep-linked fiddle if the URL has a hash, else (2) the developer's
  // favorite fiddle, else (3) the "select a fiddle" prompt. Both routes reuse open().
  function landOn(fw, name){
    const f=FIDDLES.find(x=>x.framework===fw&&x.name===name);
    if(f) open(f, [...document.querySelectorAll('.item')].find(e=>e.dataset.key===fw+'/'+name));
    return !!f;
  }
  // Framework-only hash (e.g. #three, deep-linked from the site's "Earlier explorations"):
  // filter the sidebar to that framework and open its landing fiddle — the favorite if it
  // lives in that framework, else the first live one.
  function landOnFramework(fw){
    const box=document.querySelector('.search'); if(box) box.value=fw;
    render(fw);
    const favInFw = (FAVORITE && FAVORITE.split('/')[0]===fw) ? FIDDLES.find(x=>x.framework+'/'+x.name===FAVORITE) : null;
    const pick = favInFw || FIDDLES.find(x=>x.framework===fw && x.live!==false) || FIDDLES.find(x=>x.framework===fw);
    if(pick) open(pick, [...document.querySelectorAll('.item')].find(e=>e.dataset.key===pick.framework+'/'+pick.name));
    return !!pick;
  }
  const hash = location.hash.slice(1);
  if(hash.includes('/')){
    const [fw,name]=hash.split('/'); landOn(fw,name);
  } else if(hash){
    landOnFramework(hash);
  } else if(FAVORITE){
    const [fw,name]=FAVORITE.split('/'); landOn(fw,name);
  }
</script>
</body>
</html>
`
}
