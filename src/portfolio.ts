// The auto-generated portfolio: a manifest of the collection + a Storybook-like
// shell (sidebar nav grouped by framework → each fiddle in an iframe pane).
// Phosphor/CRT aesthetic. Self-contained — deploys to any static host.

export interface ManifestEntry {
  framework: string
  name: string // fiddle-0001-foo
  friendly: string // foo
  url: string // f/<framework>/<name>/index.html
  thumb: string | null // thumbs/<framework>__<name>.png
  live: boolean // false = source-only (no runnable demo; opens straight to code)
  files: string[] // source files, relative to the fiddle dir (for the source view)
}

export function buildManifest(
  items: { framework: string; name: string; friendly: string; hasThumb: boolean; live?: boolean; files?: string[] }[]
): ManifestEntry[] {
  return items
    .map((i) => ({
      framework: i.framework,
      name: i.name,
      friendly: i.friendly,
      url: `f/${i.framework}/${i.name}/`, // the DIRECTORY, not index.html — so SPA routers (vue-router) match their home route instead of falling to a 404 on "/index.html"
      thumb: i.hasThumb ? `thumbs/${i.framework}__${i.name}.png` : null,
      live: i.live !== false,
      files: i.files ?? []
    }))
    .sort((a, b) => a.framework.localeCompare(b.framework) || a.name.localeCompare(b.name))
}

export function shellHtml(manifest: ManifestEntry[], title = 'fiddles', favorite = ''): string {
  const DATA = JSON.stringify(manifest)
  // The landing fiddle (config `favorite`, as "<framework>/<name>"). Only honored if it
  // matches a real entry — otherwise the shell falls back to the "select a fiddle" prompt.
  const FAV = JSON.stringify(favorite && manifest.some((m) => `${m.framework}/${m.name}` === favorite) ? favorite : '')
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
  header{grid-column:1/-1;background:var(--phos-bg);border-bottom:1px solid var(--line);position:relative;overflow:hidden;padding:14px 20px;font-family:var(--mono)}
  header::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0,rgba(0,0,0,.2) 1px,transparent 1px,transparent 3px);opacity:.6}
  header h1{position:relative;color:var(--phos);font-size:15px;font-weight:700;letter-spacing:.02em;text-shadow:0 0 7px rgba(51,255,51,.5)}
  header h1 .dim{color:var(--phos-dim);font-weight:400}
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
  <header><h1>brady@house<span class="dim">:~/</span>fiddles<span class="dim"> — a decade of build-to-learn</span></h1></header>
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
        tabs = document.getElementById('tabs'), src = document.getElementById('src'), codeBtn = document.getElementById('codeBtn');
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
    cur.textContent = f.framework + ' / ' + humanize(f.friendly);
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
    it.innerHTML='<div class="thumb"'+(f.thumb?' style="background-image:url('+f.thumb+')"':'')+'></div><div class="lbl">'+humanize(f.friendly)+'</div>'+star+tag;
    it.onclick=()=>open(f,it); return it;
  }
  function render(filter=''){
    filter = filter.trim().toLowerCase();
    const byFw = {};
    for(const f of FIDDLES){
      if(filter && !(f.framework+' '+f.friendly+' '+humanize(f.friendly)).toLowerCase().includes(filter)) continue;
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
  if(location.hash){
    const [fw,name]=location.hash.slice(1).split('/');
    landOn(fw,name);
  } else if(FAVORITE){
    const [fw,name]=FAVORITE.split('/');
    landOn(fw,name);
  }
</script>
</body>
</html>
`
}
