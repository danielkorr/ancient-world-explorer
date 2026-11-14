import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from '../config.mjs';

const policy = JSON.parse(await readFile(new URL('../policy/core-baseline.json', import.meta.url), 'utf8'));
const sha256 = (content) => createHash('sha256').update(content).digest('hex');

function removeExact(source, exact, label) {
  assert.ok(source.includes(exact), `approved integration marker missing: ${label}`);
  return source.replace(exact, '');
}

function restoreExact(source, changed, baseline, label) {
  assert.ok(source.includes(changed), `approved integration marker missing: ${label}`);
  return source.replace(changed, baseline);
}

function normalizeApprovedIntegration(relative, source) {
  if (relative === 'index.html') {
    source = restoreExact(source, 'css/style.css?v=171', 'css/style.css?v=170', 'stylesheet cache version');
    source = restoreExact(source, 'js/app.js?v=185', 'js/app.js?v=184', 'app cache version');
    source = removeExact(source, '\n<script src="js/argo-sites.js?v=1"></script>', 'ARGO manifest script');
    source = removeExact(source, '\n    <section id="argo-media-panel" class="argo-media-panel" data-testid="argo-media-panel" hidden aria-label="ARGO site imagery"><div class="argo-media-heading">ARGO source imagery</div><div id="argo-media-switches" class="argo-media-switches" role="group" aria-label="Choose image type"></div><figure><img id="argo-media-image" alt="" loading="lazy"><figcaption id="argo-media-caption"></figcaption></figure><div id="argo-media-credit" class="argo-media-credit"></div></section>', 'ARGO media panel');
    source = restoreExact(source, '<li><strong>Contribute directly.</strong> Add your image through <a id="quest-pleiades-link" href="https://pleiades.stoa.org/participate" target="_blank" rel="noopener noreferrer">Pleiades Participate</a>. AWE does not collect or forward submissions.</li>', '<li><strong>Submit it.</strong> Share the photo on social with <code>#VIAquest</code> and tag the site. We\'ll relay confirmed submissions back to Pleiades\' scholarly record.</li>', 'direct contribution step');
    source = removeExact(source, '\n    <div id="quest-machine-tag" class="quest-machine-tag" hidden><label for="quest-machine-tag-value">Suggested Flickr depicts tag</label><code id="quest-machine-tag-value"></code><button id="quest-machine-tag-copy" type="button" onclick="copyQuestMachineTag()">Copy tag</button></div>', 'suggested machine tag');
    source = removeExact(source, '\n    <a class="auth-secondary quest-external-link" href="https://www.flickr.com/groups/pleiades-places/pool/" target="_blank" rel="noopener noreferrer">View Pleiades Places Photos (Flickr)</a>', 'Flickr secondary link');
  } else if (relative === 'css/style.css') {
    source = removeExact(source, '\n/* ARGO reviewed media and direct contribution controls */\n.argo-media-panel{margin:16px 0;padding:14px;border:1px solid #8c744d66;border-radius:8px;background:#17130e}.argo-media-panel[hidden]{display:none}.argo-media-heading{color:#dfc58c;font:600 12px Cinzel,serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px}.argo-media-switches{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}.argo-media-switches button,.quest-external-link{cursor:pointer;border:1px solid #8c744d;border-radius:5px;padding:7px 10px;color:#f1dfb8;background:#211b12;text-decoration:none}.argo-media-switches button[aria-pressed="true"]{background:#574426;border-color:#d6b875}.argo-media-panel figure{margin:0}.argo-media-panel img{display:block;width:100%;max-height:360px;object-fit:contain;background:#090807}.argo-media-panel figcaption,.argo-media-credit{color:#d0c6b3;font-size:12px;line-height:1.5;margin-top:8px}.argo-media-credit a{color:#e5c477;margin-left:4px}.quest-external-link{display:block;text-align:center;margin:8px 0}.quest-machine-tag{margin:12px 0;padding:10px;border:1px solid #8c744d;border-radius:6px;color:#e7dcc8}.quest-machine-tag[hidden]{display:none}.quest-machine-tag label{display:block;font-size:12px;margin-bottom:6px}.quest-machine-tag code{display:inline-block;margin-right:8px;color:#f4d58e}.quest-machine-tag button{padding:6px 9px;background:#211b12;color:#f1dfb8;border:1px solid #8c744d;border-radius:4px}', 'ARGO media and Photo Quest styles');
    if (source.endsWith('\n\n')) source = source.slice(0, -1);
  } else if (relative === 'js/app.js') {
    source = restoreExact(source, "text:  'No qualifying image is linked to the Wikidata record Pleiades cross-references. Photos may exist elsewhere; contribute a suitable image directly through Pleiades Participate.',", "text:  'No qualifying image is linked to the Wikidata record Pleiades cross-references. Photos may exist elsewhere; help connect one to the scholarly record.',", 'Photo Quest prompt');
    source = restoreExact(source, "pitch: 'Help document this place with a photograph. Contribute directly to Pleiades using its participation guidance; you choose the account and licensing terms. VIA does not collect, approve, or forward submissions.',", "pitch: 'This isn’t a Pleiades photo field — Pleiades doesn’t have one. VIA checks whether the Wikidata item Pleiades cross-references has an image on file, and this one doesn’t. A photo of the place may already exist online; if so, add it to Wikimedia Commons and set it as that item’s image, and the record catches up automatically.',", 'direct contribution pitch');
    source = restoreExact(source, "    blurb: 'No image is linked to the Wikidata record Pleiades cross-references. Help document the place by contributing directly through Pleiades Participate.',", "    blurb: 'No image is linked to the Wikidata record Pleiades cross-references — even if photos of the place exist elsewhere. Add one to Wikimedia Commons/Wikidata to close the gap.',", 'Photo Quest blurb');
    source = removeExact(source, `function renderArgoMedia(site) {
  const panel=document.getElementById('argo-media-panel'); if(!panel)return;
  const entry=site&&site.pleiades&&window.ARGO_SITE_MEDIA&&window.ARGO_SITE_MEDIA[site.pleiades]; if(!entry){panel.hidden=true;return;} panel.hidden=false;
  const img=document.getElementById('argo-media-image'),cap=document.getElementById('argo-media-caption'),credit=document.getElementById('argo-media-credit'),switches=document.getElementById('argo-media-switches'); switches.replaceChildren();
  const choose=i=>{const x=entry.assets[i];img.src=x.src;img.alt=x.caption;cap.textContent=x.caption;credit.replaceChildren();const by=document.createElement('span');by.textContent=x.credit+' · CC BY 4.0. ';const src=document.createElement('a');src.href=x.source;src.target='_blank';src.rel='noopener noreferrer';src.textContent='Source';const lic=document.createElement('a');lic.href=x.license;lic.target='_blank';lic.rel='noopener noreferrer';lic.textContent='License';credit.append(by,src,document.createTextNode(' · '),lic);[...switches.children].forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));};
  entry.assets.forEach((x,i)=>{const b=document.createElement('button');b.type='button';b.textContent=x.label;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>choose(i));switches.appendChild(b);});choose(0);
}

`, 'ARGO media renderer');
    source = removeExact(source, '\n  renderArgoMedia(site);', 'ARGO renderer call');
    source = removeExact(source, `
  const tagBox=document.getElementById('quest-machine-tag'), tagValue=document.getElementById('quest-machine-tag-value');
  const pleiadesId=String(site.pleiades||'');
  if(tagBox&&tagValue){if(/^\\d+$/.test(pleiadesId)){tagValue.textContent='pleiades:depicts='+pleiadesId;tagBox.hidden=false;}else{tagValue.textContent='';tagBox.hidden=true;}}
`, 'suggested machine tag logic');
    source = removeExact(source, `
function copyQuestMachineTag() {
  const value=document.getElementById('quest-machine-tag-value')?.textContent||'';
  if(!/^pleiades:depicts=\\d+$/.test(value))return;
  navigator.clipboard?.writeText(value).then(()=>{const b=document.getElementById('quest-machine-tag-copy');if(b){const t=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=t,1800);}}).catch(()=>{});
}
`, 'machine tag copy action');
  }
  return source;
}

test('research lab changes leave protected core files unchanged outside approved AWE integration', async () => {
  for (const [relative, expected] of Object.entries(policy.sha256)) {
    const bytes = await readFile(path.join(REPO_ROOT, relative));
    const content = bytes.toString('utf8').replace(/\r\n/g, '\n');
    const normalized = normalizeApprovedIntegration(relative, content);
    const actual = sha256(normalized);
    assert.equal(actual, expected, `${relative} differs from protected baseline ${policy.baseline_commit}`);
  }
});