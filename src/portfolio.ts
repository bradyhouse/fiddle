// The auto-generated portfolio: a manifest of the collection + a Storybook-like
// shell (sidebar nav grouped by framework → each fiddle in an iframe pane).
// Phosphor/CRT aesthetic. Self-contained — deploys to any static host.

export interface ManifestEntry {
  framework: string
  name: string // fiddle-0001-foo
  friendly: string // foo
  url: string // f/<framework>/<name>/index.html
  thumb: string | null // thumbs/<framework>__<name>.png
}

export function buildManifest(
  items: { framework: string; name: string; friendly: string; hasThumb: boolean }[]
): ManifestEntry[] {
  return items
    .map((i) => ({
      framework: i.framework,
      name: i.name,
      friendly: i.friendly,
      url: `f/${i.framework}/${i.name}/index.html`,
      thumb: i.hasThumb ? `thumbs/${i.framework}__${i.name}.png` : null
    }))
    .sort((a, b) => a.framework.localeCompare(b.framework) || a.name.localeCompare(b.name))
}

export function shellHtml(manifest: ManifestEntry[], title = 'fiddles'): string {
  const DATA = JSON.stringify(manifest)
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
  .bar{display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12px;color:var(--muted)}
  .bar .cur{color:var(--phos)}
  .bar a{margin-left:auto;color:var(--phos-dim);text-decoration:none}.bar a:hover{color:var(--phos)}
  iframe{flex:1;width:100%;border:0;background:#fff}
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
    <div class="bar"><span class="cur" id="cur">—</span><a id="pop" href="#" target="_blank" style="display:none">open ↗</a></div>
    <div class="empty" id="empty">select a fiddle from the left</div>
    <iframe id="frame" style="display:none"></iframe>
  </main>
<script>
  const FIDDLES = ${DATA};
  const nav = document.getElementById('nav'), frame = document.getElementById('frame'),
        empty = document.getElementById('empty'), cur = document.getElementById('cur'), pop = document.getElementById('pop');
  function open(f, el){
    document.querySelectorAll('.item.active').forEach(e=>e.classList.remove('active'));
    if(el){ el.classList.add('active'); const g=el.closest('.fw-group'); if(g) g.classList.add('open'); el.scrollIntoView({block:'nearest'}); }
    empty.style.display='none'; frame.style.display='block'; frame.src=f.url;
    cur.textContent = f.framework + ' / ' + f.friendly;
    pop.style.display='inline'; pop.href=f.url;
    location.hash = f.framework + '/' + f.name;
  }
  function itemEl(f){
    const it=document.createElement('div'); it.className='item'; it.dataset.key=f.framework+'/'+f.name;
    it.innerHTML='<div class="thumb"'+(f.thumb?' style="background-image:url('+f.thumb+')"':'')+'></div><div class="lbl">'+f.friendly+'</div>';
    it.onclick=()=>open(f,it); return it;
  }
  function render(filter=''){
    filter = filter.trim().toLowerCase();
    const byFw = {};
    for(const f of FIDDLES){
      if(filter && !(f.framework+' '+f.friendly).toLowerCase().includes(filter)) continue;
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
  // deep-link support (exact framework/name match, then expand + select)
  if(location.hash){
    const [fw,name]=location.hash.slice(1).split('/');
    const f=FIDDLES.find(x=>x.framework===fw&&x.name===name);
    if(f){ render(); open(f, [...document.querySelectorAll('.item')].find(e=>e.dataset.key===fw+'/'+name)); }
  }
</script>
</body>
</html>
`
}
