const $ = (id) => document.getElementById(id);
const form = $('repo-form'), input = $('repo-url'), workspace = $('workspace'), loading = $('loading');
let graph = { nodes: [], links: [] }, selected = null, drag = null, offset = { x: 0, y: 0 };
const canvas = $('graph'), ctx = canvas.getContext('2d');

function repoParts(value) {
  try { const u = new URL(value); const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/').filter(Boolean); if (u.hostname !== 'github.com' || parts.length < 2) return null; return { owner: parts[0], repo: parts[1] }; } catch { return null; }
}
function demoNodes(name) {
  const paths = ['src/index.js','src/app.js','src/graph/engine.js','src/graph/layout.js','src/components/Inspector.jsx','src/components/Graph.jsx','src/styles.css','tests/engine.test.js','README.md','package.json'];
  return paths.map((path, i) => ({ id: path, label: path.split('/').pop(), x: 0, y: 0, size: i === 2 ? 10 : 6, type: path.endsWith('.md') || path.endsWith('.json') ? 'config' : 'code' }));
}
function makeLinks(nodes) {
  const links = [];
  nodes.forEach((n, i) => { if (i) links.push({ source: n.id, target: nodes[Math.max(0, i - 1)].id }); if (i > 2 && i % 2 === 0) links.push({ source: n.id, target: nodes[i - 3].id }); });
  return links;
}
async function loadRepo(parts) {
  const response = await fetch(`https://api.github.com/repos/${parts.owner}/${parts.repo}/git/trees/HEAD?recursive=1`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error('GitHub returned an unavailable repository.');
  const data = await response.json();
  const files = (data.tree || []).filter(x => x.type === 'blob' && !/(node_modules|dist|build|\.lock$)/.test(x.path)).slice(0, 70);
  if (!files.length) throw new Error('No files found in this repository.');
  const nodes = files.map((f) => ({ id: f.path, label: f.path.split('/').pop(), x: 0, y: 0, size: 5 + Math.min(6, Math.log2((f.size || 10) / 100 + 1)), type: /\.(json|md|yml|yaml|css)$/.test(f.path) ? 'config' : 'code' }));
  return { nodes, links: makeLinks(nodes), name: `${parts.owner}/${parts.repo}` };
}
function prepare(data) {
  graph = data; const w = canvas.clientWidth, h = canvas.clientHeight; graph.nodes.forEach((n, i) => { const a = (i / graph.nodes.length) * Math.PI * 2; const r = Math.min(w, h) * (.18 + (i % 3) * .07); n.x = w / 2 + Math.cos(a) * r; n.y = h / 2 + Math.sin(a) * r; });
  $('repo-name').textContent = data.name || 'Repository graph'; $('file-count').textContent = data.nodes.length; $('edge-count').textContent = data.links.length; $('risk-score').textContent = '—'; draw();
}
function nodeAt(x, y) { return graph.nodes.slice().reverse().find(n => Math.hypot(n.x - x, n.y - y) < Math.max(12, n.size + 5)); }
function neighbors(id) { const out = new Set(); graph.links.forEach(l => { if (l.source === id) out.add(l.target); if (l.target === id) out.add(l.source); }); return out; }
function selectNode(n) { selected = n; const related = neighbors(n.id); const percent = Math.min(99, Math.round((related.size / Math.max(1, graph.nodes.length - 1)) * 100 + 8)); $('selected-name').textContent = n.label; $('radius-number').innerHTML = `${percent}<small>%</small>`; $('impact-fill').style.width = `${percent}%`; $('upstream-count').textContent = graph.links.filter(l => l.target === n.id).length; $('downstream-count').textContent = graph.links.filter(l => l.source === n.id).length; $('file-path').textContent = n.id; $('risk-score').textContent = `${percent}%`; $('radius-copy').textContent = percent > 45 ? 'High-impact node. Changes here may ripple across several connected modules.' : 'Low-to-moderate impact. Most of the repository remains isolated from this node.'; draw(); }
function draw() { const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== w*dpr) { canvas.width=w*dpr; canvas.height=h*dpr; ctx.scale(dpr,dpr); } ctx.clearRect(0,0,w,h); const related = selected ? neighbors(selected.id) : new Set(); graph.links.forEach(l => { const a=graph.nodes.find(n=>n.id===l.source), b=graph.nodes.find(n=>n.id===l.target); ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=selected?(related.has(a.id)&&related.has(b.id)?'#6b493f':'#29302f'):'#34403a';ctx.lineWidth=selected&&related.has(a.id)&&related.has(b.id)?1.5:1;ctx.stroke(); }); graph.nodes.forEach(n=>{const active=!selected||n===selected||related.has(n.id);ctx.globalAlpha=active?1:.2;ctx.beginPath();ctx.arc(n.x,n.y,n===selected?n.size+5:n.size,0,Math.PI*2);ctx.fillStyle=n===selected?'#d4f96b':related.has(n.id)?'#ff765c':n.type==='config'?'#74b9ff':'#52605a';ctx.shadowColor=n===selected?'#d4f96b':'transparent';ctx.shadowBlur=n===selected?18:0;ctx.fill();ctx.shadowBlur=0;if(active&&n.size>7){ctx.fillStyle='#c4ccc5';ctx.font='10px DM Mono';ctx.fillText(n.label,n.x+11,n.y+3);} });ctx.globalAlpha=1; }
canvas.addEventListener('pointerdown', e => { const r=canvas.getBoundingClientRect(); const n=nodeAt(e.clientX-r.left,e.clientY-r.top); if(n){drag={n,dx:n.x-(e.clientX-r.left),dy:n.y-(e.clientY-r.top)};canvas.setPointerCapture(e.pointerId);} });
canvas.addEventListener('pointermove', e => { if(drag){const r=canvas.getBoundingClientRect();drag.n.x=e.clientX-r.left+drag.dx;drag.n.y=e.clientY-r.top+drag.dy;draw();} });
canvas.addEventListener('pointerup', e => { if(drag){ if(Math.abs(drag.dx)<30) selectNode(drag.n); drag=null; } });
form.addEventListener('submit', async e => { e.preventDefault(); const parts=repoParts(input.value.trim()); $('form-message').textContent=''; workspace.classList.remove('is-hidden'); loading.classList.remove('is-hidden'); try { const data=parts?await loadRepo(parts):{nodes:demoNodes('demo'),links:[]}; data.links=data.links.length?data.links:makeLinks(data.nodes); prepare({...data,name:parts?`${parts.owner}/${parts.repo}`:'Local topology preview'}); } catch(err) { $('form-message').textContent=err.message+' Showing a topology preview instead.'; const nodes=demoNodes();prepare({nodes,links:makeLinks(nodes),name:'Topology preview'}); } finally { loading.classList.add('is-hidden'); workspace.scrollIntoView({behavior:'smooth',block:'start'}); } });
$('reset').addEventListener('click',()=>{selected=null;$('selected-name').textContent='Click a node';$('radius-number').innerHTML='—<small>%</small>';$('impact-fill').style.width='0';$('upstream-count').textContent='0';$('downstream-count').textContent='0';$('file-path').textContent='No node selected';$('risk-score').textContent='—';draw();});
window.addEventListener('resize', draw); form.dispatchEvent(new Event('submit'));
