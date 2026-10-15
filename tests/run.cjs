'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (() => {
  try { return require.resolve('playwright'); }
  catch { return path.join(os.tmpdir(), 'ai-atlas-browser-tools', 'node_modules', 'playwright'); }
})());
const root = path.resolve(__dirname, '..');
const url = process.env.ATLAS_URL || pathToFileURL(path.join(root, 'index.html')).href;
const hosted = /^https?:/.test(url);
const origin = hosted ? new URL(url).origin : null;
// Emulates host rules from dist/_headers (for example the CSP) when testing a served build.
const responseHeaders = process.env.ATLAS_HEADERS ? Object.fromEntries(fs.readFileSync(process.env.ATLAS_HEADERS, 'utf8').split(/\r?\n/).filter(line => /^\s+[\w-]+:/.test(line)).map(line => [line.slice(0, line.indexOf(':')).trim().toLowerCase(), line.slice(line.indexOf(':') + 1).trim()])) : {};
const artifacts = path.join(__dirname, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const browserErrors = [];
const externalRequests = [];
const policyViolations = [];
let checks = 0;
function check(name, condition) { assert.ok(condition, name); checks++; process.stdout.write('PASS ' + name + '\n'); }
async function main() {
  const candidates = process.platform === 'win32' ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'] : [];
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || candidates.find(candidate => fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    if (!hosted) await context.setOffline(true);
    if (Object.keys(responseHeaders).length) await context.route('**/*', async route => { const response = await route.fetch(); await route.fulfill({ response, headers: { ...response.headers(), ...responseHeaders } }); });
    const page = await context.newPage();
    page.on('pageerror', failure => browserErrors.push(failure.message));
    page.on('console', message => { if (/Content Security Policy/.test(message.text())) policyViolations.push(message.text()); });
    page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) externalRequests.push(request.url()); });
    await page.goto(url);
    await page.waitForFunction(() => !!window.AIAtlas?.render);
    check(hosted ? 'loads from the web server' : 'opens directly from file while offline', await page.locator('h1').textContent() === 'How Does AI Actually Work?');
    const catalog = await page.evaluate(() => window.AIAtlas.concepts.map(topic => ({ id: topic.id, title: topic.title, kind: topic.kind })));
    check('36 connected concept pages', catalog.length === 36);
    check('all concepts have dedicated simulations', await page.evaluate(() => window.AIAtlas.concepts.every(topic => window.AIAtlas.simulations[topic.kind])));
    const dataChecks = await page.evaluate(() => {
      const atlas = window.AIAtlas;
      const checks = [];
      const test = (name, condition) => { if (!condition) throw new Error(name); checks.push(name); };
      test('valid concept links', atlas.concepts.every(topic => [...topic.path, ...topic.connections].every(id => atlas.byId[id])));
      test('116 glossary entries link to valid topics', atlas.glossary.length === 116 && atlas.glossary.every(entry => atlas.byId[entry.topic]));
      test('stable softmax normalized', Math.abs(atlas.math.softmax([1000, 1001, 1002]).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      const attention = atlas.math.attention([1, 1], [[1, 0], [0, 1], [1, 1]], [[2, 0], [0, 2], [8, 8]], 2);
      test('causal mask excludes future value', attention.weights[2] === 0 && Math.abs(attention.output[0] - 1) < 1e-12);
      test('exact cl100k IDs', atlas.tokenize('The cat is sitting on the mat').ids.join() === '791,8415,374,11961,389,279,5634');
      for (const text of ['emoji: 🧠', '<|endoftext|>', 'plain text', '', 'café']) test('tokenizer roundtrip ' + JSON.stringify(text), atlas.tokenize(text).decoded === text);
      const probabilities = atlas.math.distribution([3, 2, 1, 0], 1, 2, 0.8);
      test('top-k excludes low candidates', probabilities[2] === 0 && probabilities[3] === 0);
      test('sampling renormalizes', Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      test('temperature zero greedy', atlas.math.distribution([2, 8, 1], 0, 3, 1).join() === '0,1,0');
      test('moderate rate converges', atlas.gradientHistory(0.2).at(-1).loss < 0.0001);
      test('large rate diverges', atlas.gradientHistory(1.2).at(-1).loss > 9);
      test('trillion weight budget', atlas.math.weightMemory(1e12, 2, 8).shardGB === 250);
      test('KV memory formula', atlas.math.kvMemory(32, 8, 128, 8, 2) === 1048576);
      test('retrieval returns KV source', atlas.retrieve('How does KV cache save work?')[0].docId === 'S1');
      test('unknown corpus question abstains', atlas.retrieve('zzzzzzzz').length === 0);
      test('retrieval metadata filter', atlas.retrieve('cache', { filter: 'systems' }).every(document => document.category === 'systems'));
      test('actual calculator', atlas.executeTool(atlas.toolExamples.calculator).result.value === 391);
      for (const request of [{ tool: 'calculate', arguments: { a: 1, b: 0, operation: 'divide' } }, { tool: 'calculate', arguments: { a: 1, b: 2, operation: '__proto__' } }, { tool: 'export_data', arguments: {} }, { tool: 'unknown' }, { tool: 'get_weather', location: 'Bangalore', extra: 'bad' }, { tool: 'get_weather', location: '__proto__' }]) {
        let rejected = false;
        try { atlas.executeTool(request); } catch { rejected = true; }
        test('unsafe/invalid tool request rejected: ' + request.tool, rejected);
      }
      test('unchecked toy fixture suite fails', atlas.runToyEvaluations('baseline').every(result => !result.passed));
      test('checked toy fixture suite passes', atlas.runToyEvaluations('checked').every(result => result.passed));
      const learner = atlas.createGridLearner(0.2);
      learner.train(200);
      const rollout = learner.rollout();
      test('Q-learning policy reaches goal', rollout.at(-1).state === 15);
      test('Q-learning policy avoids penalty', rollout.every(step => step.state !== 10));
      test('continuous batching completes all output', atlas.simulateServing(16, 4, 512, true).at(-1).requests.every(request => request.generated === request.target));
      return checks;
    });
    dataChecks.forEach(name => check(name, true));
    const rendered = await page.evaluate(() => {
      const atlas = window.AIAtlas;
      const rendered = [];
      for (const topic of atlas.concepts) {
        atlas.render(topic.id);
        if (document.querySelector('h1').textContent !== topic.title) throw new Error('Heading ' + topic.id);
        if (!document.querySelector('#simulation')?.children.length) throw new Error('Visualization ' + topic.id);
        if (document.querySelectorAll('.where-grid>div').length !== 5) throw new Error('Physical location ' + topic.id);
        if (!document.querySelector('#explanation-text')?.textContent) throw new Error('Explanation ' + topic.id);
        for (const frame of [0, Math.floor(atlas.activePlayer.length / 2), atlas.activePlayer.length - 1]) atlas.activePlayer.seek(frame);
        if (document.querySelector('.katex-error')) throw new Error('Invalid formula ' + topic.id);
        rendered.push(topic.id);
      }
      return rendered;
    });
    check('all routes render and step through intermediate/final states', rendered.length === 36);
    async function route(id) {
      await page.evaluate(id => { if (location.hash.slice(1) === id) window.AIAtlas.render(id); else location.hash = id; }, id);
      await page.waitForFunction(id => window.AIAtlas.state.route === id, id);
    }
    await route('neural');
    const oldProbabilities = await page.locator('#simulation').getAttribute('data-probabilities');
    await page.locator('#nn-weight').fill('-1');
    check('weight control changes actual network output', oldProbabilities !== await page.locator('#simulation').getAttribute('data-probabilities'));
    await route('attention');
    await page.locator('[data-attention-token="0"]').click();
    check('first token cannot attend to future positions', (await page.locator('#simulation').getAttribute('data-attention-weights')) === '[1,0,0,0,0,0,0,0,0,0]');
    await page.locator('[data-attention-token="7"]').click();
    await page.getByRole('button', { name: 'Step forward', exact: true }).click();
    check('attention matrix phase is inspectable', await page.locator('.matrix').count() > 0);
    await route('tokens');
    await page.locator('#token-input').fill('<img src=x onerror=alert(1)>');
    check('token input is escaped, not executed', await page.locator('#simulation img').count() === 0);
    await route('gpus');
    await page.locator('#gpu-count').selectOption('16');
    check('GPU control recalculates the ideal shard', await page.evaluate(() => Number(document.getElementById('simulation').dataset.shardGB) === 125));
    await page.locator('#parallel-mode').selectOption('data');
    check('data parallelism replicates rather than divides weights', await page.evaluate(() => Number(document.getElementById('simulation').dataset.shardGB) === 2000));
    await route('tools');
    await page.locator('#tool-example').selectOption('calculator');
    await page.locator('#execute-tool').click();
    check('tool button executes the actual local runtime', await page.evaluate(() => JSON.parse(document.getElementById('simulation').dataset.toolResult).value === 391));
    await page.locator('#tool-json').fill('{"tool":"calculate","arguments":{"a":1,"b":0,"operation":"divide"}}');
    await page.locator('#execute-tool').click();
    check('tool failure is visible and no result is fabricated', (await page.locator('#simulation').getAttribute('data-tool-error')).includes('zero'));
    await route('agents');
    await page.locator('#agent-budget').fill('1');
    await page.evaluate(() => window.AIAtlas.activePlayer.seek(window.AIAtlas.activePlayer.length - 1));
    check('agent respects its tool budget', await page.locator('#simulation').getAttribute('data-agent-calls') === '1' && await page.locator('#simulation').getAttribute('data-agent-partial') === 'true');
    await route('reward');
    await page.locator('#reward-shortcut').click();
    check('reward shortcut scores without solving', await page.locator('#simulation').getAttribute('data-reward-score') === '100' && await page.locator('#simulation').getAttribute('data-reward-solved') === 'false');
    await page.locator('#reward-policy').selectOption('verified');
    await page.locator('#reward-shortcut').click();
    check('outcome check removes shortcut reward', await page.locator('#simulation').getAttribute('data-reward-score') === '0');
    await route('hallucination');
    await page.locator('#hallucination-structured').check();
    check('structured output alone does not ensure truth', await page.locator('#simulation').getAttribute('data-claim-supported') === 'false');
    await page.locator('#hallucination-rag').check();
    check('retrieval supplies support for fixture claim', await page.locator('#simulation').getAttribute('data-claim-supported') === 'true');
    await route('map');
    check('map includes every linked concept', await page.evaluate(() => window.AIAtlas.concepts.every(topic => document.querySelector('#simulation [data-node="' + topic.id + '"][data-route="' + topic.id + '"]'))));
    await route('mental');
    await page.locator('#map-journey').selectOption('drill');
    await page.evaluate(() => window.AIAtlas.activePlayer.seek(4));
    check('mental-model drill-down reaches GPU computation', await page.locator('#simulation').getAttribute('data-journey-step') === 'gpus' && (await page.locator('.map-current h3').textContent()).includes('Tensor cores'));
    await route('map');
    const initialZoom = await page.evaluate(() => d3.zoomTransform(document.querySelector('#simulation svg')).k);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    check('diagram zoom changes transform', await page.evaluate(() => d3.zoomTransform(document.querySelector('#simulation svg')).k) > initialZoom);
    await page.getByRole('button', { name: 'Fit diagram', exact: true }).click();
    await page.locator('#map-focus').selectOption('transformers');
    await page.locator('#simulation [data-node="attention"]').click();
    await page.waitForFunction(() => window.AIAtlas.state.route === 'attention');
    check('clicking a map node navigates to its visualization', await page.locator('h1').textContent() === 'Attention & Q / K / V');
    await page.getByRole('tab', { name: 'Technical explanation' }).click();
    check('progressive explanation disclosure works', await page.locator('#explanation-text').textContent() === await page.evaluate(() => window.AIAtlas.byId.attention.technical));
    await page.locator('#math-toggle').check();
    check('mathematics renders locally', await page.locator('#equation-container .katex').count() === 1);
    await page.locator('[data-progress="attention"]').selectOption('mastered');
    await page.reload();
    check('learning status persists across reloads', await page.locator('[data-progress="attention"]').inputValue() === 'mastered');
    await page.getByRole('button', { name: 'Switch color theme' }).click();
    await page.reload();
    check('theme persists across reloads', await page.locator('html').getAttribute('data-theme') === 'dark');
    await page.screenshot({ path: path.join(artifacts, 'dark-attention.png'), fullPage: true });
    await page.getByRole('button', { name: 'Switch color theme' }).click();
    await route('glossary');
    await page.locator('#glossary-search').fill('KV cache');
    check('glossary search filters and links', await page.locator('#glossary-results a[href="#kv"]').count() > 0);
    await page.locator('#glossary-results a[href="#kv"]').first().click();
    await page.waitForFunction(() => window.AIAtlas.state.route === 'kv');
    check('glossary opens the relevant simulation', await page.locator('h1').textContent() === 'KV cache');
    await route('learning');
    check('learning path restores topic status', await page.locator('[data-progress="attention"]').inputValue() === 'mastered');
    const viewportChecks = [];
    for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'laptop', width: 1280, height: 800 }, { name: 'tablet', width: 1024, height: 768 }, { name: 'portrait-tablet', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      for (const id of ['home', 'attention', 'gpus', 'map', 'production', 'glossary', 'learning']) {
        await route(id);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
        check('no page overflow at ' + viewport.name + ' / ' + id, !overflow);
      }
      await route('home');
      await page.screenshot({ path: path.join(artifacts, viewport.name + '-home.png'), fullPage: true });
      viewportChecks.push(viewport.name);
    }
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.locator('#nav-search').fill('quantization');
    check('mobile navigation search finds concepts', await page.locator('#navigation .nav-link').count() === 2 || await page.locator('#navigation .nav-link').count() === 1);
    await page.locator('#navigation a[href="#quantization"]').click();
    await page.waitForFunction(() => window.AIAtlas.state.route === 'quantization');
    check('mobile navigation opens selected concept', await page.locator('h1').textContent() === 'Quantization & precision');
    check('mobile navigation closes after selection', !(await page.locator('#sidebar').getAttribute('class')).includes('open'));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await route('home');
    await page.locator('#nav-search').fill('');
    await page.evaluate(() => { window.AIAtlas.activePlayer.seek(10); });
    await page.screenshot({ path: path.join(root, 'assets', 'desktop-preview.png'), fullPage: true });
    const svgAssetCheck = await page.evaluate(async () => {
      const svg = document.querySelector('#simulation svg');
      const copy = svg.cloneNode(true);
      const originals = [svg, ...svg.querySelectorAll('*')];
      const clones = [copy, ...copy.querySelectorAll('*')];
      originals.forEach((element, index) => { const style = getComputedStyle(element); ['fill', 'stroke', 'font-family', 'font-size', 'font-weight', 'stroke-width', 'opacity'].forEach(property => clones[index].style.setProperty(property, style.getPropertyValue(property))); });
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' });
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = objectUrl; });
      const canvas = document.createElement('canvas');
      canvas.width = 900; canvas.height = 470;
      const drawing = canvas.getContext('2d');
      drawing.fillStyle = '#ffffff'; drawing.fillRect(0, 0, canvas.width, canvas.height);
      drawing.drawImage(image, 0, 0, 900, 470);
      const pixels = drawing.getImageData(0, 0, 900, 470).data;
      let nonWhite = 0;
      for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 235 || pixels[index + 1] < 235 || pixels[index + 2] < 235) nonWhite++;
      URL.revokeObjectURL(objectUrl);
      return nonWhite;
    });
    check('primary diagram paints nonblank pixels', svgAssetCheck > 5000);
    check('no JavaScript runtime errors', browserErrors.length === 0);
    check('no external network dependency', externalRequests.length === 0);
    check('no Content Security Policy violations', policyViolations.length === 0);
    const report = { checks, url, concepts: catalog.length, viewports: viewportChecks, offline: !hosted, responseHeaders: Object.keys(responseHeaders), browserErrors, externalRequests, policyViolations };
    fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
    process.stdout.write('\n' + JSON.stringify(report, null, 2) + '\n');
  } finally { await browser.close(); }
}
main().catch(failure => { process.stderr.write(String(failure.stack || failure) + '\n'); process.exitCode = 1; });