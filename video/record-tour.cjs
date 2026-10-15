'use strict';
// Records a captioned 1920x1080 MP4 tour of Follow the Token: node video/record-tour.cjs [output.mp4]
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (() => {
  try { return require.resolve('playwright'); }
  catch { return path.join(os.tmpdir(), 'ai-atlas-browser-tools', 'node_modules', 'playwright'); }
})());

const root = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(root, 'index.html')).href;
const output = path.resolve(process.argv[2] || path.join(__dirname, 'follow-the-token-tour.mp4'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const viewport = { width: 1280, height: 720 };
// Content must stay between the top edge and the caption bar to remain readable.
const safe = { top: 24, bottom: 640 };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function director() {
  const css = `
#demo-cursor{position:fixed;left:0;top:0;width:24px;height:24px;z-index:2147483647;pointer-events:none;transform:translate(-80px,-80px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transition:opacity .25s}
#demo-cursor.hidden{opacity:0}
.demo-ripple{position:fixed;z-index:2147483646;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2px solid #0a9c97;background:rgba(10,156,151,.18);pointer-events:none;animation:demo-ripple .6s ease-out forwards}
@keyframes demo-ripple{from{transform:scale(.2);opacity:1}to{transform:scale(1.45);opacity:0}}
#demo-caption{position:fixed;left:calc(var(--sidebar) + 24px);right:24px;bottom:12px;display:flex;justify-content:center;pointer-events:none;z-index:2147483640}
#demo-caption .box{max-width:990px;padding:9px 20px 10px;border-radius:10px;border-left:3px solid #2ab3a6;background:rgba(15,22,25,.94);box-shadow:0 10px 30px rgba(0,0,0,.28);opacity:0;transform:translateY(10px);transition:opacity .3s ease,transform .3s ease}
#demo-caption.show .box{opacity:1;transform:none}
#demo-caption .kicker{margin-bottom:3px;font:600 11px/1.2 "IBM Plex Mono",Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#6ed2c4}
#demo-caption .text{font:600 17px/1.35 Manrope,"Segoe UI",sans-serif;color:#f3f7f7;white-space:nowrap}
#demo-card{position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;pointer-events:none;color:#eef3f3;font-family:Manrope,"Segoe UI",sans-serif;background:radial-gradient(900px 520px at 22% 18%,rgba(14,140,136,.30),transparent 62%),radial-gradient(800px 480px at 88% 92%,rgba(137,80,172,.20),transparent 60%),#0f1517;opacity:0;visibility:hidden;transition:opacity .8s ease,visibility 0s linear .8s}
#demo-card.show{opacity:1;visibility:visible;transition:opacity .8s ease,visibility 0s}
#demo-card.instant{transition:none!important}
#demo-card .inner{display:flex;flex-direction:column;align-items:center;gap:16px;max-width:900px;padding:0 40px;text-align:center}
#demo-card .mark{display:grid;place-items:center;width:66px;height:66px;border-radius:17px;background:#087f7e;color:#fff;animation:demo-glow 2.4s ease-in-out infinite alternate}
#demo-card .mark svg{width:36px;height:36px}
@keyframes demo-glow{from{box-shadow:0 8px 34px rgba(18,170,165,.30)}to{box-shadow:0 8px 64px rgba(18,170,165,.70)}}
#demo-card .brand{font-size:14px;font-weight:800;letter-spacing:.34em;color:#6ed2c4}
#demo-card h1{margin:0;font-size:54px;line-height:1.1;font-weight:800;letter-spacing:-.02em;color:#f4f8f8}
#demo-card p{margin:0;max-width:760px;font-size:20px;line-height:1.5;color:#b8c6c7}
#demo-card code{padding:4px 10px;border-radius:7px;background:rgba(110,210,196,.10);color:#7fe0d3;font:500 18px "IBM Plex Mono",Consolas,monospace}
#demo-card .chips{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:10px}
#demo-card .chips span{padding:9px 15px;border:1px solid rgba(110,210,196,.35);border-radius:999px;background:rgba(255,255,255,.03);color:#d7e4e3;font:500 13px/1 "IBM Plex Mono",Consolas,monospace;letter-spacing:.03em}
#demo-menu{position:fixed;z-index:2147483644;display:none;padding:5px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);box-shadow:0 16px 36px rgba(15,30,40,.22);font:500 13.5px/1.25 Manrope,"Segoe UI",sans-serif}
#demo-menu.open{display:block}
#demo-menu div{padding:7px 12px;border-radius:5px;white-space:nowrap}
#demo-menu div.current{background:var(--surface-alt);font-weight:700}
#demo-menu div:hover{background:var(--accent);color:var(--surface)}
`;
  const pointer = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 2.8v17.4l4.7-4.3 3.1 6.6 3.1-1.4-3-6.5h6.4z" fill="#fff" stroke="#10181b" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  let layer = null;
  let captionTimer = null;
  const api = {
    caption(kicker, text) {
      const element = layer.querySelector('#demo-caption');
      clearTimeout(captionTimer);
      const apply = () => { element.querySelector('.kicker').textContent = kicker; element.querySelector('.text').textContent = text; element.classList.add('show'); };
      if (element.classList.contains('show')) { element.classList.remove('show'); captionTimer = setTimeout(apply, 320); } else apply();
    },
    hideCaption() { clearTimeout(captionTimer); layer.querySelector('#demo-caption').classList.remove('show'); },
    card(html, instant = false) {
      const card = layer.querySelector('#demo-card');
      card.innerHTML = '<div class="inner">' + html.replace('{{mark}}', document.querySelector('.brand-symbol')?.innerHTML || '') + '</div>';
      if (instant) { card.classList.add('instant', 'show'); void card.offsetHeight; card.classList.remove('instant'); }
      else card.classList.add('show');
    },
    hideCard() { layer.querySelector('#demo-card').classList.remove('show'); },
    cursor(visible) { layer.querySelector('#demo-cursor').classList.toggle('hidden', !visible); },
    ripple(x, y) {
      const ring = document.createElement('div');
      ring.className = 'demo-ripple';
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';
      layer.appendChild(ring);
      setTimeout(() => ring.remove(), 700);
    },
    menu(rect, labels, current) {
      const menu = layer.querySelector('#demo-menu');
      menu.replaceChildren(...labels.map((label, index) => { const row = document.createElement('div'); row.textContent = label; if (index === current) row.className = 'current'; return row; }));
      menu.style.left = rect.x + 'px';
      menu.style.top = rect.y + rect.height + 4 + 'px';
      menu.style.minWidth = rect.width + 'px';
      menu.classList.add('open');
      return [...menu.children].map(row => { const box = row.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; });
    },
    menuClose() { layer.querySelector('#demo-menu').classList.remove('open'); },
    scrollTo(top, duration) {
      const start = scrollY;
      const end = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, top));
      if (Math.abs(end - start) < 2) return Promise.resolve(end);
      const length = duration || Math.max(450, Math.min(1100, Math.abs(end - start) * 1.3));
      const began = performance.now();
      return new Promise(resolve => {
        const step = now => {
          const progress = Math.min(1, (now - began) / length);
          const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
          window.scrollTo(0, start + (end - start) * eased);
          if (progress < 1) requestAnimationFrame(step); else resolve(end);
        };
        requestAnimationFrame(step);
      });
    }
  };
  function install() {
    if (layer) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    layer = document.createElement('div');
    layer.id = 'demo-layer';
    layer.innerHTML = '<div id="demo-card"></div><div id="demo-caption"><div class="box"><div class="kicker"></div><div class="text"></div></div></div><div id="demo-menu"></div><div id="demo-cursor">' + pointer + '</div>';
    document.body.appendChild(layer);
    const cursor = layer.querySelector('#demo-cursor');
    addEventListener('mousemove', event => { cursor.style.transform = 'translate(' + (event.clientX - 4) + 'px,' + (event.clientY - 2.8) + 'px)'; }, true);
    addEventListener('mousedown', event => api.ripple(event.clientX, event.clientY), true);
  }
  window.__demo = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
}

const titleCard = '<div class="mark">{{mark}}</div><div class="brand">FOLLOW THE TOKEN</div><h1>How does AI actually work?</h1><p>An interactive, connected mental model, from neurons and tokens to production AI systems.</p><div class="chips"><span>36 concepts</span><span>116 glossary terms</span><span>Real in-browser calculations</span><span>Runs fully offline</span></div>';
const outroCard = '<div class="mark">{{mark}}</div><div class="brand">FOLLOW THE TOKEN</div><h1>Explore it yourself</h1><p>Visit <code>followthetoken.com</code> in any modern browser.</p><div class="chips"><span>No install</span><span>No server</span><span>No API key</span><span>Nothing you type leaves the browser</span></div>';

async function main() {
  const candidates = process.platform === 'win32' ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'] : [];
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || candidates.find(candidate => fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const frameDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-atlas-tour-'));
  const frames = [];
  const chapters = [];
  const browserErrors = [];
  let recordingStart = 0;
  try {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1.5, colorScheme: 'light', reducedMotion: 'no-preference' });
    await context.setOffline(true);
    await context.addInitScript(director);
    const page = await context.newPage();
    page.on('pageerror', failure => browserErrors.push(failure.message));
    await page.goto(appUrl);
    await page.waitForFunction(() => !!window.AIAtlas?.render && !!document.getElementById('demo-layer'));
    await page.evaluate(() => document.fonts.ready.then(() => true));

    let mouse = { x: 760, y: 430 };
    const demo = (method, ...args) => page.evaluate(([method, args]) => window.__demo[method](...args), [method, args]);
    const resolve = target => typeof target === 'string' ? page.locator(target).first() : target;
    const chapter = name => chapters.push({ name, at: (performance.now() - recordingStart) / 1000 });
    const caption = (kicker, text) => demo('caption', kicker, text);
    const scrollTo = (top, duration) => demo('scrollTo', top, duration || 0);
    async function glide(x, y, duration) {
      const from = { ...mouse };
      const length = duration || Math.max(350, Math.min(950, 260 + Math.hypot(x - from.x, y - from.y) * 0.75));
      const steps = Math.max(10, Math.round(length / 16));
      const began = Date.now();
      for (let step = 1; step <= steps; step++) {
        const progress = step / steps;
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        await page.mouse.move(from.x + (x - from.x) * eased, from.y + (y - from.y) * eased);
        const wait = began + length * progress - Date.now();
        if (wait > 0) await sleep(wait);
      }
      mouse = { x, y };
    }
    async function reveal(locator, below = 0) {
      await locator.waitFor({ state: 'visible' });
      const rect = await locator.boundingBox();
      if (rect.y >= safe.top && rect.y + rect.height + below <= safe.bottom) return;
      const current = await page.evaluate(() => scrollY);
      const delta = rect.y < safe.top ? rect.y - safe.top - 24 : rect.y + rect.height + below - safe.bottom + 24;
      await scrollTo(current + delta);
    }
    async function hover(target) {
      const locator = resolve(target);
      await reveal(locator);
      const rect = await locator.boundingBox();
      await glide(rect.x + rect.width / 2, rect.y + rect.height / 2);
    }
    async function click(target, { scroll = true } = {}) {
      const locator = resolve(target);
      if (scroll) await reveal(locator); else await locator.waitFor({ state: 'visible' });
      const rect = await locator.boundingBox();
      await glide(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await sleep(140);
      await page.mouse.down();
      await sleep(70);
      await page.mouse.up();
    }
    async function go(target, route, options) {
      await click(target, options);
      await page.waitForFunction(route => window.AIAtlas.state.route === route, route);
      await sleep(200);
    }
    async function choose(target, value) {
      const select = resolve(target);
      const count = await select.evaluate(element => element.options.length);
      await reveal(select, count * 31 + 16);
      const rect = await select.boundingBox();
      await glide(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await sleep(140);
      await demo('ripple', mouse.x, mouse.y);
      const options = await select.evaluate(element => ({ labels: [...element.options].map(option => option.textContent), current: element.selectedIndex }));
      const rows = await demo('menu', rect, options.labels, options.current);
      const index = await select.evaluate((element, value) => [...element.options].findIndex(option => option.value === value), value);
      await sleep(280);
      await glide(rows[index].x + Math.min(rows[index].width / 2, 80), rows[index].y + rows[index].height / 2, 520);
      await sleep(240);
      await demo('ripple', mouse.x, mouse.y);
      await sleep(90);
      await demo('menuClose');
      await select.selectOption(value);
    }
    async function drag(target, value, duration = 900) {
      const slider = resolve(target);
      await reveal(slider);
      const rect = await slider.boundingBox();
      const range = await slider.evaluate(input => ({ min: Number(input.min), max: Number(input.max), current: Number(input.value) }));
      const thumb = number => rect.x + 8 + (number - range.min) / (range.max - range.min) * (rect.width - 16);
      const y = rect.y + rect.height / 2;
      await glide(thumb(range.current), y);
      await sleep(120);
      await page.mouse.down();
      await glide(thumb(value), y, duration);
      await page.mouse.up();
      if (Number(await slider.inputValue()) !== value) await slider.fill(String(value));
    }
    async function typeInto(target, text, { delay = 70, scroll = true } = {}) {
      await click(target, { scroll });
      await page.keyboard.press('Control+A');
      if (text) await page.keyboard.type(text, { delay });
      else await page.keyboard.press('Backspace');
    }
    async function search(query, route) {
      await typeInto('#nav-search', query, { delay: 80, scroll: false });
      await sleep(450);
      await go('#navigation a[href="#' + route + '"]', route, { scroll: false });
    }
    const untilPaused = () => page.waitForFunction(() => !window.AIAtlas.activePlayer.running, null, { timeout: 30000 });

    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const file = path.join(frameDirectory, String(frames.length).padStart(6, '0') + '.jpg');
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      frames.push({ file, time: metadata.timestamp, local: performance.now() / 1000 });
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });

    await page.mouse.move(mouse.x, mouse.y);
    await demo('cursor', false);
    await demo('card', titleCard, true);
    await sleep(300);
    recordingStart = performance.now();
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });

    chapter('Title');
    await sleep(3800);
    await demo('hideCard');
    await sleep(600);
    await demo('cursor', true);

    chapter('Follow the data');
    await caption('Follow the data', 'One question, traced from human language to a generated response.');
    await sleep(1800);
    await scrollTo(325);
    await sleep(300);
    await drag('#animation-speed', 2.5);
    await sleep(250);
    await click('[data-action="play"]');
    await sleep(3600);
    await caption('Follow the data', 'Tokenization is real (cl100k_base); the answer is a clearly labeled scripted example.');
    await untilPaused();
    await sleep(1800);

    chapter('The AI map');
    await go('#navigation a[href="#map"]', 'map', { scroll: false });
    await caption('The AI map', '36 connected concepts on one zoomable map. Every node opens an interactive model.');
    await sleep(1000);
    await scrollTo(290);
    await hover('#simulation [data-node="neural"]');
    await sleep(500);
    await hover('#simulation [data-node="transformer"]');
    await sleep(700);
    await choose('#map-focus', 'transformers');
    await sleep(1700);
    await go('#simulation [data-node="attention"]', 'attention');

    chapter('Attention');
    await caption('Attention', 'Pick a token: causal attention weights are computed live. Future words stay masked.');
    await sleep(500);
    await scrollTo(290);
    await click('[data-attention-token="0"]');
    await sleep(1700);
    await click('[data-attention-token="9"]');
    await sleep(1400);
    await click('[data-attention-token="7"]');
    await sleep(1500);
    await caption('Attention', 'Step through the math: Q\u00b7K\u1d40 scores, the causal mask, softmax, and the weighted values.');
    await scrollTo(430);
    for (const stage of ['Q / K / V', 'Causal mask', 'Softmax']) {
      await click(page.getByRole('button', { name: stage, exact: true }));
      await sleep(1600);
    }

    chapter('Explanations');
    await caption('Every concept', 'Three explanation depths, the mathematics, a concrete example, and where it physically runs.');
    const explanationTop = await page.locator('.explanation-section').evaluate(element => element.getBoundingClientRect().top + scrollY);
    await scrollTo(explanationTop - 80);
    await sleep(700);
    await click(page.getByRole('tab', { name: 'Technical explanation' }));
    await sleep(1800);
    await click(page.getByRole('tab', { name: 'System architecture' }));
    await sleep(1500);
    await click('#math-toggle');
    await sleep(2400);

    chapter('Tokenization');
    await go('#navigation a[href="#tokens"]', 'tokens', { scroll: false });
    await caption('Tokenization', 'Type anything: the real cl100k_base vocabulary splits it into tokens and IDs.');
    await scrollTo(200);
    await typeInto('#token-input', 'Unbelievably, Follow the Token runs offline \u{1F9E0}');
    await sleep(2800);

    chapter('Neural networks');
    await go('#navigation a[href="#neural"]', 'neural', { scroll: false });
    await caption('Neural networks', 'Drag a weight: activations and output probabilities are recalculated instantly.');
    await scrollTo(290);
    await drag('#nn-weight', -1.6, 1300);
    await sleep(800);
    await drag('#nn-weight', 1.8, 1300);
    await sleep(1800);

    chapter('How a model learns');
    await go('#navigation a[href="#optimization"]', 'optimization', { scroll: false });
    await caption('How a model learns', 'Gradient descent with a sensible learning rate walks the loss down to its minimum.');
    await scrollTo(305);
    await drag('#animation-speed', 3, 600);
    await click('[data-action="play"]');
    await untilPaused();
    await sleep(800);
    await caption('How a model learns', 'Make the learning rate too large and every step overshoots: the loss diverges.');
    await choose('#learning-example', 'large');
    await sleep(500);
    await click('[data-action="play"]');
    await untilPaused();
    await sleep(1500);

    chapter('Sampling');
    await search('sampling', 'sampling');
    await caption('Sampling', 'Temperature reshapes the next-token distribution: low is near-greedy, high is more random.');
    await scrollTo(280);
    await drag('#temperature', 0.2);
    await sleep(1200);
    await drag('#temperature', 2);
    await sleep(900);
    for (let sample = 0; sample < 3; sample++) {
      await click('#sample-token');
      await sleep(450);
    }
    await sleep(900);

    chapter('Models at scale');
    await search('GPU', 'gpus');
    await caption('Models at scale', 'Tensor parallelism splits a trillion-parameter model across GPUs; data parallelism copies it.');
    await scrollTo(290);
    await choose('#gpu-count', '16');
    await sleep(1600);
    await choose('#parallel-mode', 'data');
    await sleep(1900);

    chapter('Tools');
    await search('tools', 'tools');
    await caption('Tools', 'The model only proposes JSON. The runtime validates it and runs a real local calculator.');
    await scrollTo(290);
    await choose('#tool-example', 'calculator');
    await sleep(1300);
    await click('#execute-tool');
    await sleep(2500);

    chapter('Grounding');
    await search('hallucination', 'hallucination');
    await caption('Grounding', 'Valid JSON is not truth: verification abstains without evidence; retrieval supplies a source.');
    await scrollTo(290);
    await click('#hallucination-structured');
    await sleep(1800);
    await click('#hallucination-verify');
    await sleep(1800);
    await click('#hallucination-rag');
    await sleep(2100);

    chapter('Glossary');
    await typeInto('#nav-search', '', { scroll: false });
    await go('.sidebar-bottom a[href="#glossary"]', 'glossary', { scroll: false });
    await caption('Glossary', '116 terms, each linked to the simulation where it lives.');
    await sleep(900);
    await typeInto('#glossary-search', 'KV cache', { delay: 85 });
    await sleep(1400);
    await go('#glossary-results a[href="#kv"]', 'kv');

    chapter('Your progress');
    await caption('Your progress', 'Mark what you understand. Progress is saved in this browser, with no account needed.');
    await sleep(1200);
    await choose('[data-progress="kv"]', 'mastered');
    await sleep(1400);
    await go('.sidebar-bottom a[href="#learning"]', 'learning', { scroll: false });
    await sleep(1000);
    await choose('[data-progress="tokens"]', 'understand');
    await sleep(1800);

    chapter('Light & dark');
    await scrollTo(0);
    await caption('Light & dark', 'Everything runs locally: no server, no API key, no model calls.');
    await click('#theme-toggle', { scroll: false });
    await sleep(1500);
    await go('#navigation a[href="#home"]', 'home', { scroll: false });
    await scrollTo(325);
    await click('[data-action="play"]');
    await sleep(3700);

    chapter('Outro');
    await demo('hideCaption');
    await demo('cursor', false);
    await demo('card', outroCard);
    await sleep(5200);
    const stopped = performance.now() / 1000;
    await cdp.send('Page.stopScreencast');
    await sleep(300);
    if (frames.length < 2) throw new Error('The screencast produced too few frames.');

    const timed = frames.every(frame => typeof frame.time === 'number');
    const lines = ['ffconcat version 1.0'];
    frames.forEach((frame, index) => {
      const next = frames[index + 1];
      const duration = next ? (timed ? next.time - frame.time : next.local - frame.local) : Math.max(0.04, stopped - frame.local);
      lines.push("file '" + frame.file.replace(/\\/g, '/') + "'", 'duration ' + Math.max(0.001, duration).toFixed(5));
    });
    lines.push("file '" + frames.at(-1).file.replace(/\\/g, '/') + "'");
    const list = path.join(frameDirectory, 'frames.ffconcat');
    fs.writeFileSync(list, lines.join('\n') + '\n');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const encoded = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,scale=1920:1080:flags=lanczos:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', output], { encoding: 'utf8' });
    if (encoded.error || encoded.status !== 0) throw new Error('ffmpeg failed: ' + (encoded.error?.message || encoded.stderr));
    const seconds = (timed ? frames.at(-1).time - frames[0].time : frames.at(-1).local - frames[0].local) + Math.max(0.04, stopped - frames.at(-1).local);
    const stamp = value => Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
    process.stdout.write('Video: ' + output + '\nDuration: ' + stamp(seconds) + ' (' + frames.length + ' captured frames)\n' + chapters.map(item => '  ' + stamp(item.at) + '  ' + item.name).join('\n') + '\n');
    if (browserErrors.length) process.stdout.write('Browser errors:\n' + browserErrors.join('\n') + '\n');
  } finally {
    await browser.close();
    fs.rmSync(frameDirectory, { recursive: true, force: true });
  }
}

main().catch(failure => { process.stderr.write(String(failure.stack || failure) + '\n'); process.exitCode = 1; });
