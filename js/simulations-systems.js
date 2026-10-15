(function () {
  'use strict';
  const Atlas = window.AIAtlas;
  const math = Atlas.math;
  const escape = Atlas.escape;
  Atlas.simulateServing = (count, capacity, inputTokens, continuous) => {
    const requests = Array.from({ length: count }, (_, index) => ({ id: index + 1, target: [8, 12, 16, 7, 14][index % 5], generated: 0, first: null, finish: null }));
    const records = [{ clock: 0, requests: requests.map(request => ({ ...request })), active: [], admitted: [] }];
    let queue = 0;
    let active = [];
    let clock = 0;
    while (requests.some(request => request.finish === null) && records.length < 200) {
      const admitted = [];
      if (continuous || active.length === 0) {
        while (active.length < capacity && queue < requests.length) { admitted.push(requests[queue].id); active.push(requests[queue++]); }
      }
      if (admitted.length) clock += 20 + inputTokens * 0.02 * admitted.length;
      clock += 3 + active.length * 0.9;
      active.forEach(request => { request.generated++; if (request.first === null) request.first = clock; if (request.generated === request.target) request.finish = clock; });
      records.push({ clock, requests: requests.map(request => ({ ...request })), active: active.map(request => request.id), admitted });
      active = active.filter(request => request.finish === null);
    }
    return records;
  };
  Atlas.simulations.serving = (root) => {
    const controls = Atlas.slider('serve-concurrency', 'Concurrent requests', 8, 1, 16, 1) + Atlas.slider('serve-batch', 'Batch capacity', 4, 1, 8, 1) + Atlas.slider('serve-input', 'Prompt tokens / request', 512, 128, 4096, 128) + Atlas.select('serve-mode', 'Scheduler', [['continuous', 'Continuous batching'], ['static', 'Static batches']], 'continuous');
    const panels = Atlas.layout(root, controls, '<div class="metrics-row" id="serve-metrics"></div>');
    let records;
    function prepare() { records = Atlas.simulateServing(Number(root.querySelector('#serve-concurrency').value), Number(root.querySelector('#serve-batch').value), Number(root.querySelector('#serve-input').value), root.querySelector('#serve-mode').value === 'continuous'); }
    prepare();
    const player = Atlas.createPlayer({ length: records.length, interval: 380, onFrame(frame) {
      const record = records[frame];
      const queued = record.requests.filter(request => !record.active.includes(request.id) && request.finish === null);
      const finished = record.requests.filter(request => request.finish !== null);
      let drawing = Atlas.linearDiagram([{ label: 'API gateway', sub: 'AUTH + RATE LIMIT', color: 'data' }, { label: 'Request queue', sub: queued.length + ' PENDING', color: 'storage' }, { label: 'Scheduler', sub: record.active.length + ' IN LAST BATCH', color: 'decision' }, { label: 'GPU worker', sub: 'PREFILL + DECODE', color: 'compute' }], Math.min(3, frame), 'data');
      let requests = '<text class="chart-title" x="45" y="201">Request lifecycle</text>';
      record.requests.forEach((request, index) => {
        const x = 45 + index % 8 * 108;
        const y = 229 + Math.floor(index / 8) * 109;
        const active = record.active.includes(request.id) && request.finish === null;
        const complete = request.finish !== null;
        const color = complete ? 'storage' : active ? 'compute' : 'data';
        requests += '<g><rect x="' + x + '" y="' + y + '" width="94" height="86" rx="4" fill="var(--surface)" stroke="var(--' + color + ')" opacity="' + (complete || active ? 1 : 0.5) + '"/><text class="chart-title" x="' + (x + 10) + '" y="' + (y + 23) + '">Request ' + request.id + '</text><text class="chart-label" x="' + (x + 10) + '" y="' + (y + 46) + '">' + request.generated + ' / ' + request.target + ' tokens</text><rect x="' + (x + 10) + '" y="' + (y + 61) + '" width="73" height="4" fill="var(--line)"/><rect x="' + (x + 10) + '" y="' + (y + 61) + '" width="' + (73 * request.generated / request.target) + '" height="4" fill="var(--' + color + ')"/><text class="chart-label" x="' + (x + 10) + '" y="' + (y + 79) + '" font-size="8">' + (complete ? 'COMPLETE' : active ? 'DECODING' : 'QUEUED') + '</text></g>';
      });
      drawing = drawing.replace('viewBox="0 0 900 200"', 'viewBox="0 0 930 465"').replace('</g></svg>', requests + '<text class="diagram-note" x="45" y="453">TOY TIMING: PREFILL 20 + 0.02 x PROMPT TOKENS x NEW REQUESTS ms; DECODE 3 + 0.9 x BATCH ms.</text></g></svg>');
      Atlas.paint(panels.visual, drawing);
      const admitted = record.requests.filter(request => request.first !== null);
      const ttft = admitted.length ? admitted.reduce((sum, request) => sum + request.first, 0) / admitted.length : 0;
      const tokenCount = record.requests.reduce((sum, request) => sum + request.generated, 0);
      const tpot = finished.length ? finished.reduce((sum, request) => sum + (request.finish - request.first) / (request.target - 1), 0) / finished.length : null;
      panels.inspector.innerHTML = Atlas.dataPanel('Scheduling step ' + frame, 'All ' + record.requests.length + ' requests arrive at time 0 in this toy.', record.admitted.length ? 'Admit requests ' + record.admitted.join(', ') + '; prefill and decode the active batch.' : frame ? 'Decode one token per active sequence.' : 'Wait in the request queue.', '<strong>' + queued.length + ' queued / ' + finished.length + ' complete</strong>', 'kv') + '<h4>PER REQUEST / FIRST TOKEN</h4><table class="data-table">' + record.requests.slice(0, 8).map(request => '<tr><th>R' + request.id + '</th><td>' + (request.first === null ? 'pending' : Atlas.format(request.first, 1) + ' ms') + '</td></tr>').join('') + '</table><p class="sim-caption">Synthetic timings for scheduling intuition, not measured GPU performance. Queueing is included in TTFT.</p>';
      root.querySelector('#serve-metrics').innerHTML = Atlas.metric('Mean TTFT / admitted', Atlas.format(ttft, 1) + ' ms', 'data') + Atlas.metric('Mean TPOT / finished', tpot === null ? 'Pending' : Atlas.format(tpot, 1) + ' ms', 'compute') + Atlas.metric('Aggregate tokens / sec', record.clock ? Atlas.format(tokenCount / (record.clock / 1000), 1) : '0', 'storage') + Atlas.metric('Toy elapsed time', Atlas.format(record.clock, 1) + ' ms', 'compute');
      root.dataset.serveTokens = tokenCount;
      root.dataset.serveFinished = finished.length;
    } });
    function update() { prepare(); player.length = records.length; player.seek(0); }
    root.addEventListener('input', update);
    root.addEventListener('change', update);
    player.draw();
    return player;
  };
  Atlas.simulations.gpus = (root) => {
    const controls = Atlas.slider('gpu-parameters', 'Parameters / billions', 1000, 1, 1000, 1) + Atlas.select('gpu-count', 'GPUs', [1, 2, 4, 8, 16, 32, 64, 128].map(value => [value, String(value)]), 8) + Atlas.select('gpu-precision', 'Weight precision', [['2', 'FP16 / BF16'], ['4', 'FP32'], ['1', 'INT8'], ['0.5', 'INT4 packed']], 2) + Atlas.select('parallel-mode', 'Parallelism', [['tensor', 'Tensor'], ['pipeline', 'Pipeline'], ['data', 'Data / replicas'], ['expert', 'Expert / MoE']], 'tensor');
    const panels = Atlas.layout(root, controls, '<div class="metrics-row" id="gpu-metrics"></div>');
    let defaultsMounted = false;
    const player = Atlas.createPlayer({ length: 10, onFrame(frame) {
      if (!defaultsMounted) { panels.inspector.innerHTML = '<div class="inspector-heading"><span class="tiny-label">DEVICE MEMORY BUDGET</span><h3>Does it fit?</h3></div>' + Atlas.slider('gpu-capacity', 'HBM capacity / GPU', 80, 32, 192, 8, ' GB') + Atlas.slider('gpu-overhead', 'Additional per-GPU budget', 8, 0, 64, 1, ' GB') + '<div id="gpu-detail"></div>'; Atlas.bindInputs(panels.inspector); defaultsMounted = true; }
      const parameters = Number(root.querySelector('#gpu-parameters').value) * 1e9;
      const devices = Number(root.querySelector('#gpu-count').value);
      const bytes = Number(root.querySelector('#gpu-precision').value);
      const mode = root.querySelector('#parallel-mode').value;
      const capacity = Number(root.querySelector('#gpu-capacity').value);
      const overhead = Number(root.querySelector('#gpu-overhead').value);
      const memory = math.weightMemory(parameters, bytes, devices);
      const shardGB = mode === 'data' ? memory.totalGB : mode === 'expert' ? memory.totalGB * (0.1 + 0.9 / devices) : memory.shardGB;
      const required = shardGB + overhead;
      const fits = required <= capacity;
      const shown = Math.min(8, devices);
      player.length = shown + 2;
      player.frame = Math.min(player.frame, player.length - 1);
      let drawing = '<text class="chart-title" x="45" y="34">' + (mode === 'data' ? 'Replicate the whole model' : mode === 'pipeline' ? 'Partition groups of layers' : mode === 'expert' ? 'Shared layers + distributed experts' : 'Shard one tensor operation') + '</text><text class="diagram-note" x="45" y="58">' + Atlas.format(parameters / 1e9, 0) + 'B PARAMETERS / ' + Atlas.format(memory.totalGB, 0) + ' GB TOTAL WEIGHTS</text>';
      const cells = mode === 'pipeline' ? 12 : 16;
      for (let row = 0; row < 8; row++) {
        for (let column = 0; column < cells; column++) {
          const shard = mode === 'pipeline' ? Math.floor(row * devices / 8) : Math.floor(column * devices / cells);
          drawing += '<rect x="' + (139 + column * 36) + '" y="' + (82 + row * 16) + '" width="32" height="12" rx="1" fill="var(--model)" opacity="' + (frame === 0 || frame > shown || shard === (frame - 1) ? 0.65 : 0.16) + '"/>';
        }
      }
      drawing += '<text class="diagram-note" x="139" y="230">' + (mode === 'expert' ? 'TOY MoE BUDGET: 10% SHARED WEIGHTS REPLICATED, 90% EXPERT WEIGHTS SHARDED.' : mode === 'data' ? 'EACH GPU NEEDS THE FULL WEIGHT SET; DATA PARALLELISM DOES NOT SOLVE WEIGHT FIT.' : 'IDEAL EVEN PARTITION. COMMUNICATION AND ACTIVATIONS ARE ADDITIONAL.') + '</text>';
      for (let index = 0; index < shown; index++) {
        const x = 45 + index % 4 * 217;
        const y = 286 + Math.floor(index / 4) * 135;
        drawing += Atlas.edge('M425,210 V263 H' + (x + 86) + ' V' + (y - 6), frame > index);
        drawing += Atlas.node({ id: String(index + 1), label: 'GPU ' + (index + 1), sub: (mode === 'data' ? 'FULL REPLICA' : mode === 'pipeline' ? 'LAYER GROUP' : mode === 'expert' ? 'EXPERT + SHARED' : 'TENSOR SHARD'), x, y, color: 'compute', active: frame === index + 1 });
        drawing += '<rect x="' + (x + 12) + '" y="' + (y + 85) + '" width="148" height="8" rx="2" fill="var(--line)"/><rect x="' + (x + 12) + '" y="' + (y + 85) + '" width="' + Math.min(148, required / capacity * 148) + '" height="8" rx="2" fill="var(--' + (fits ? 'storage' : 'error') + ')"/><text class="chart-label" x="' + (x + 12) + '" y="' + (y + 110) + '">' + Atlas.format(required, 1) + ' / ' + capacity + ' GB</text>';
      }
      if (devices > shown) drawing += '<text class="diagram-note" x="45" y="579">' + devices + ' DEVICES TOTAL / FIRST ' + shown + ' SHOWN</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 920, shown > 4 ? 600 : 450, 'Model tensors or layers distributed across GPUs with calculated memory budgets'));
      const descriptions = { tensor: 'Each device computes a piece of a layer; collectives combine partial results.', pipeline: 'Layer groups pass intermediate activations between devices; scheduling can create pipeline bubbles.', data: 'Replicas handle different requests or training batches. Weights are not split.', expert: 'Token states are dispatched to selected experts. Shared weights remain replicated in this budget.' };
      panels.inspector.querySelector('#gpu-detail').innerHTML = Atlas.notice(fits ? 'Fits this chosen budget' : 'Exceeds device capacity', Atlas.format(shardGB, 1) + ' GB weights + ' + overhead + ' GB additional budget. ' + descriptions[mode], fits ? 'storage' : 'error') + '<p class="sim-caption">Decimal GB (1 GB = 10^9 bytes). Ideal sharding and assumed overhead; not an allocator guarantee. Low-bit metadata is excluded from weight bytes.</p><a class="inspect-link" href="#kv">Inspect KV cache memory ' + Atlas.icon('arrow-up-right') + '</a>';
      root.querySelector('#gpu-metrics').innerHTML = Atlas.metric('Total weights', Atlas.format(memory.totalGB, 0) + ' GB', 'model') + Atlas.metric(mode === 'data' ? 'Weights / replica' : 'Weights / GPU', Atlas.format(shardGB, 1) + ' GB', 'model') + Atlas.metric('With additional budget', Atlas.format(required, 1) + ' GB', 'compute') + Atlas.metric('Budget check', fits ? 'Fits' : 'Does not fit', fits ? 'storage' : 'error');
      root.dataset.shardGB = shardGB;
      root.dataset.totalGB = memory.totalGB;
      root.dataset.fits = String(fits);
    } });
    root.addEventListener('input', () => player.draw());
    root.addEventListener('change', () => player.seek(0));
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.draw();
    return player;
  };
  Atlas.simulations.kv = (root) => {
    const panels = Atlas.layout(root, Atlas.slider('kv-sequence', 'Sequence positions', 16, 4, 64, 1) + Atlas.slider('kv-heads', 'K/V heads per layer', 8, 1, 32, 1) + Atlas.slider('kv-batch', 'Active sequences', 1, 1, 32, 1), '<div class="metrics-row" id="kv-metrics"></div>');
    const player = Atlas.createPlayer({ length: 16, interval: 430, onFrame(frame) {
      const tokens = frame + 1;
      let drawing = '<text class="chart-title" x="40" y="38">Without KV cache</text><text class="chart-title" x="475" y="38">With KV cache</text><text class="diagram-note" x="40" y="59">RECOMPUTE THE PREFIX K/V</text><text class="diagram-note" x="475" y="59">REUSE PAST K/V; PROJECT NEW POSITION</text>';
      const rows = Math.min(8, tokens);
      for (let row = 0; row < rows; row++) {
        const position = tokens > 8 && row === 7 ? tokens : row + 1;
        const y = 92 + row * 41;
        for (let index = 0; index < Math.min(position, 10); index++) {
          const newPosition = index === Math.min(position, 10) - 1;
          drawing += '<rect x="' + (40 + index * 35) + '" y="' + y + '" width="29" height="27" rx="3" fill="color-mix(in srgb,var(--compute) 12%,var(--surface))" stroke="var(--compute)"/><text x="' + (54 + index * 35) + '" y="' + (y + 18) + '" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--compute)">' + (position > 10 && newPosition ? '+' : index + 1) + '</text>';
          drawing += '<rect x="' + (475 + index * 35) + '" y="' + y + '" width="29" height="27" rx="3" fill="color-mix(in srgb,var(--' + (newPosition ? 'compute' : 'storage') + ') 10%,var(--surface))" stroke="var(--' + (newPosition ? 'compute' : 'storage') + ')"/><text x="' + (489 + index * 35) + '" y="' + (y + 18) + '" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--' + (newPosition ? 'compute' : 'storage') + ')">' + (position > 10 && newPosition ? '+' : index + 1) + '</text>';
        }
        if (position > 10) drawing += '<text class="chart-label" x="397" y="' + (y + 18) + '">' + position + ' pos</text><text class="chart-label" x="833" y="' + (y + 18) + '">' + position + ' pos</text>';
      }
      drawing += '<text class="diagram-note" x="40" y="448">ORANGE: PROJECT K/V AGAIN</text><text class="diagram-note" x="475" y="448">GREEN: READ CACHED K/V / ORANGE: PROJECT NEW K/V</text><text class="diagram-note" x="40" y="472">ROWS/CELLS COLLAPSED AFTER 8/10 FOR DISPLAY; COUNTS USE ALL POSITIONS.</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 940, 500, 'A comparison of repeated full-prefix projections and reused attention keys and values'));
      const heads = Number(root.querySelector('#kv-heads').value);
      const batch = Number(root.querySelector('#kv-batch').value);
      const bytes = math.kvMemory(32, heads, 128, tokens, 2, batch);
      const uncached = tokens * (tokens + 1) / 2;
      panels.inspector.innerHTML = Atlas.dataPanel('Position ' + tokens, 'Current query + previous context', 'Keep per-layer K and V. Compute this position once, then attend across the cached history.', '<strong>' + Atlas.format(bytes / 1024 ** 2, 2) + ' MiB cache</strong>', 'context') + '<h4>MEMORY ASSUMPTIONS</h4><p class="sim-caption">32 layers / ' + heads + ' KV heads / 128 dimensions per head / FP16 (2 bytes) / ' + batch + ' sequences.</p>' + Atlas.notice('Work counter, not speed benchmark', 'The counts refer only to projected token positions in this full-prefix baseline. Cached decode still computes attention over history. Do not interpret their ratio as total latency speedup.', 'storage');
      root.querySelector('#kv-metrics').innerHTML = Atlas.metric('Uncached position projections', uncached, 'compute') + Atlas.metric('Cached position projections', tokens, 'storage') + Atlas.metric('Projection-work ratio', Atlas.format(uncached / tokens, 1) + 'x', 'compute') + Atlas.metric('KV memory / all sequences', Atlas.format(bytes / 1024 ** 2, 2) + ' MiB', 'storage');
      root.dataset.kvBytes = bytes;
      root.dataset.uncachedProjections = uncached;
    } });
    root.addEventListener('input', event => { if (event.target.id === 'kv-sequence') { player.length = Number(event.target.value); player.seek(0); } else player.draw(); });
    player.draw();
    return player;
  };
  Atlas.simulations.quantization = (root) => {
    const formats = [{ name: 'FP32', bytes: 4, bits: 32 }, { name: 'FP16', bytes: 2, bits: 16 }, { name: 'BF16', bytes: 2, bits: 16 }, { name: 'INT8', bytes: 1, bits: 8 }, { name: 'INT4', bytes: 0.5, bits: 4 }];
    const input = [0.23, -0.77, 1.15, -1.02, 0.035, 0.9, -0.46, 0.002];
    const panels = Atlas.layout(root, Atlas.slider('quant-level', 'Precision format', 3, 0, 4, 1) + Atlas.slider('quant-parameters', 'Model parameters / billions', 70, 1, 1000, 1), '<div class="metrics-row" id="quant-metrics"></div>');
    const player = Atlas.createPlayer({ length: 5, onFrame(frame) {
      const level = Number(root.querySelector('#quant-level').value);
      const format = formats[level];
      const quantized = math.quantize(input, format.bits);
      const parameters = Number(root.querySelector('#quant-parameters').value) * 1e9;
      let drawing = '<text class="chart-title" x="55" y="38">Original vs reconstructed vector</text><text class="diagram-note" x="55" y="59">BLUE: ORIGINAL / ORANGE: RECONSTRUCTED / INTEGER FORMATS USE SYMMETRIC SCALING</text><path class="chart-axis" d="M55,231 H780"/>';
      input.forEach((value, index) => {
        const x = 79 + index * 88;
        const originalHeight = Math.abs(value) * 125;
        const reconstructedHeight = Math.abs(quantized.values[index]) * 125;
        drawing += '<rect x="' + x + '" y="' + (value >= 0 ? 231 - originalHeight : 231) + '" width="24" height="' + originalHeight + '" fill="var(--data)" opacity=".7"/><rect x="' + (x + 27) + '" y="' + (quantized.values[index] >= 0 ? 231 - reconstructedHeight : 231) + '" width="24" height="' + reconstructedHeight + '" fill="var(--compute)" opacity=".75"/><text class="chart-label" x="' + x + '" y="393">x' + index + '</text>';
      });
      drawing += formats.map((item, index) => Atlas.node({ id: String(index), label: item.name, sub: item.bytes + ' BYTES / WEIGHT', x: 40 + index * 160, y: 437, width: 146, height: 65, color: index >= 3 ? 'compute' : 'model', active: level === index })).join('');
      Atlas.paint(panels.visual, Atlas.svg(drawing, 870, 535, 'Weight formats and numeric reconstruction from low-bit integer quantization'));
      panels.inspector.innerHTML = Atlas.dataPanel(format.name, Atlas.vector(input, 'data'), format.bits >= 16 ? 'Float formats use only memory estimates here. Float rounding is not simulated.' : 'Scale = ' + Atlas.format(quantized.scale, 5) + '<br>Round to a signed ' + format.bits + '-bit symmetric range.' + Atlas.vector(quantized.integers, 'compute'), Atlas.vector(quantized.values, 'compute'), 'gpus') + Atlas.notice('Quality and speed need measurement', 'Lower memory can improve bandwidth-limited workloads. Actual throughput and task quality depend on kernels, hardware, calibration, and the model. This vector error is not a model accuracy score.', 'compute');
      root.querySelector('#quant-metrics').innerHTML = Atlas.metric('Format', format.name, 'model') + Atlas.metric('Ideal weight memory', Atlas.format(parameters * format.bytes / 1e9, 1) + ' GB', 'storage') + Atlas.metric('Weight-byte reduction vs FP32', Atlas.format(4 / format.bytes, 1) + 'x', 'storage') + Atlas.metric('Toy integer reconstruction MSE', format.bits >= 16 ? 'Not simulated' : Atlas.format(quantized.error, 6), 'error');
      root.querySelector('#quant-level-value').value = format.name;
      root.dataset.quantMemoryGB = parameters * format.bytes / 1e9;
      root.dataset.quantMSE = quantized.error;
    } });
    root.addEventListener('input', () => player.draw());
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) { root.querySelector('#quant-level').value = node.dataset.node; player.seek(Number(node.dataset.node)); } });
    const draw = player.draw.bind(player);
    player.draw = () => { root.querySelector('#quant-level').value = player.frame; draw(); };
    root.querySelector('#quant-level').addEventListener('input', event => player.seek(Number(event.target.value)));
    player.seek(3);
    return player;
  };
  Atlas.simulations.moe = (root) => {
    const panels = Atlas.layout(root, Atlas.slider('moe-first', 'Token-state coordinate 1', 0.6, -2, 2, 0.1) + Atlas.slider('moe-second', 'Token-state coordinate 2', 0.2, -2, 2, 0.1) + Atlas.slider('moe-active', 'Selected experts / top-k', 2, 1, 4, 1), '<div class="metrics-row" id="moe-metrics"></div>');
    const routerWeights = [[1, 0.2], [-0.5, 1.2], [0.4, -1], [1.1, 0.6]];
    const expertWeights = [[[0.7, 0.3], [-0.2, 0.8]], [[-0.5, 0.7], [0.9, 0.4]], [[0.4, -0.9], [0.2, 0.5]], [[1.1, 0.2], [-0.3, 0.6]]];
    const player = Atlas.createPlayer({ length: 6, onFrame(frame) {
      const input = [Number(root.querySelector('#moe-first').value), Number(root.querySelector('#moe-second').value)];
      const topK = Number(root.querySelector('#moe-active').value);
      const probabilities = math.softmax(routerWeights.map(row => math.dot(row, input)));
      const selected = probabilities.map((probability, index) => ({ probability, index })).sort((left, right) => right.probability - left.probability).slice(0, topK);
      const total = selected.reduce((sum, expert) => sum + expert.probability, 0);
      const mixture = selected.map(expert => ({ ...expert, weight: expert.probability / total, output: expertWeights[expert.index].map(row => Math.tanh(math.dot(row, input))) }));
      const output = [0, 1].map(coordinate => mixture.reduce((sum, expert) => sum + expert.weight * expert.output[coordinate], 0));
      let drawing = Atlas.node({ id: 'input', label: 'Token state', sub: input.map(value => Atlas.format(value, 1)).join(' / '), x: 25, y: 200, width: 140, color: 'data', active: frame === 0 }) + Atlas.edge('M165,236 H215', frame >= 1) + Atlas.node({ id: 'router', label: 'Router', sub: 'SCORE + SELECT TOP-' + topK, x: 221, y: 200, width: 150, color: 'decision', active: frame === 1 });
      for (let expert = 0; expert < 4; expert++) {
        const isSelected = selected.some(item => item.index === expert);
        const y = 32 + expert * 116;
        drawing += Atlas.edge('M371,236 H403 V' + (y + 36) + ' H440', frame >= 2 && isSelected);
        drawing += Atlas.node({ id: 'expert-' + expert, label: 'Expert ' + (expert + 1), sub: (isSelected ? 'ACTIVE' : 'AVAILABLE, NOT USED'), x: 446, y, width: 180, color: 'model', active: isSelected && frame >= 2, badge: Atlas.format(probabilities[expert] * 100, 0) + '%' });
        drawing += Atlas.edge('M626,' + (y + 36) + ' H670 V236 H715', frame >= 4 && isSelected);
      }
      drawing += Atlas.node({ id: 'output', label: 'Combine', sub: 'WEIGHTED EXPERT OUTPUT', x: 721, y: 200, width: 157, color: 'compute', active: frame >= 4 });
      drawing += '<text class="diagram-note" x="25" y="536">EXPERTS ARE FFNs, NOT INDEPENDENT CHATBOTS. NAMED SPECIALTIES ARE NOT GUARANTEED.</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 925, 568, 'A router sparsely selects feed-forward experts and combines their outputs'));
      panels.inspector.innerHTML = Atlas.dataPanel('Top-' + topK + ' routing', Atlas.vector(input, 'data'), 'Router softmax; retain the largest scores and renormalize selected mixture weights.', Atlas.vector(output, 'model'), 'ffn') + '<h4>SELECTED MIXTURE</h4><table class="data-table">' + mixture.map(expert => '<tr><th>Expert ' + (expert.index + 1) + '</th><td>' + Atlas.format(expert.weight * 100, 1) + '%</td></tr>').join('') + '</table><p class="sim-caption">Parameter budget illustration: 2B shared + 6B per expert. Separate from the tiny numeric example. All experts still require storage/access.</p>';
      root.querySelector('#moe-metrics').innerHTML = Atlas.metric('Illustrative total parameters', '26B', 'model') + Atlas.metric('Illustrative active parameters', (2 + 6 * topK) + 'B', 'compute') + Atlas.metric('Active experts', topK + ' / 4', 'decision') + Atlas.metric('Output state', output.map(value => Atlas.format(value)).join(' / '), 'model');
      root.dataset.activeParametersB = 2 + 6 * topK;
      root.dataset.selectedExperts = JSON.stringify(selected.map(expert => expert.index));
    } });
    root.addEventListener('input', () => player.draw());
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(node.dataset.node === 'input' ? 0 : node.dataset.node === 'router' ? 1 : node.dataset.node === 'output' ? 5 : 3); });
    player.draw();
    return player;
  };
  Atlas.allocateContext = (segments, capacity, strategy) => {
    const result = segments.map(segment => ({ ...segment }));
    let overflow = Math.max(0, result.reduce((sum, segment) => sum + segment.tokens, 0) - capacity);
    const reduce = name => { const segment = result.find(item => item.name === name); const drop = Math.min(segment.tokens, overflow); segment.tokens -= drop; overflow -= drop; };
    if (strategy === 'summarize') { const conversation = result.find(segment => segment.name === 'Conversation'); const reduction = Math.min(overflow, Math.floor(conversation.tokens * 0.65)); conversation.tokens -= reduction; overflow -= reduction; }
    const order = strategy === 'retrieve' ? ['Retrieved documents', 'Conversation'] : ['Conversation', 'Retrieved documents'];
    order.forEach(reduce);
    return { segments: result, overflow, dropped: segments.reduce((sum, segment) => sum + segment.tokens, 0) - result.reduce((sum, segment) => sum + segment.tokens, 0) };
  };
  Atlas.simulations.context = (root) => {
    const controls = Atlas.slider('context-limit', 'Context capacity', 1024, 256, 2048, 128) + Atlas.slider('context-conversation', 'Conversation tokens', 350, 0, 1600, 50) + Atlas.slider('context-documents', 'Retrieved tokens', 300, 0, 1600, 50) + Atlas.select('context-policy', 'Overflow strategy', [['oldest', 'Drop old conversation first'], ['retrieve', 'Retrieve fewer passages first'], ['summarize', 'Summarize, then truncate']], 'oldest') + '<button id="apply-context" class="small-button">' + Atlas.icon('filter') + 'Apply policy</button>';
    const panels = Atlas.layout(root, controls, '<div class="metrics-row" id="context-metrics"></div>');
    let applied = false;
    const player = Atlas.createPlayer({ length: 5, onFrame(frame) {
      const capacity = Number(root.querySelector('#context-limit').value);
      const original = [{ name: 'System instructions', tokens: 120, color: 'model' }, { name: 'Conversation', tokens: Number(root.querySelector('#context-conversation').value), color: 'data' }, { name: 'Retrieved documents', tokens: Number(root.querySelector('#context-documents').value), color: 'storage' }, { name: 'User question', tokens: 40, color: 'data' }, { name: 'Reserved output', tokens: 160, color: 'decision' }];
      const allocation = applied ? Atlas.allocateContext(original, capacity, root.querySelector('#context-policy').value) : { segments: original, dropped: 0 };
      const total = allocation.segments.reduce((sum, segment) => sum + segment.tokens, 0);
      const originalTotal = original.reduce((sum, segment) => sum + segment.tokens, 0);
      const overflow = Math.max(0, total - capacity);
      let drawing = '<text class="chart-title" x="52" y="37">Context inventory</text>';
      allocation.segments.forEach((segment, index) => {
        const y = 67 + index * 53;
        drawing += '<text class="chart-label" x="52" y="' + (y + 17) + '">' + segment.name + '</text><rect x="252" y="' + y + '" width="434" height="26" fill="var(--surface-alt)" rx="3"/><rect x="252" y="' + y + '" width="' + Math.min(434, segment.tokens / capacity * 434) + '" height="26" rx="3" fill="var(--' + segment.color + ')" opacity="' + (index === frame ? 0.85 : 0.4) + '"/><text class="chart-label" x="706" y="' + (y + 18) + '">' + segment.tokens + ' tokens</text>';
      });
      const scale = 700 / Math.max(capacity, total);
      let offset = 52;
      allocation.segments.forEach(segment => { drawing += '<rect x="' + offset + '" y="369" width="' + (segment.tokens * scale) + '" height="35" fill="var(--' + segment.color + ')" opacity=".65"/>'; offset += segment.tokens * scale; });
      const boundary = 52 + capacity * scale;
      drawing += '<path d="M' + boundary + ',352 V416" stroke="var(--' + (overflow ? 'error' : 'storage') + ')" stroke-width="2"/><text class="chart-label" x="52" y="439">' + total + ' total including output budget</text><text class="chart-label" x="' + Math.min(650, boundary - 95) + '" y="439">limit ' + capacity + '</text><text class="diagram-note" x="52" y="479">TOY TOKEN COUNTS. DROPPED OR SUMMARIZED TEXT DOES NOT UPDATE MODEL WEIGHTS.</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 850, 511, 'Context segments and a capacity boundary including reserved output tokens'));
      panels.inspector.innerHTML = Atlas.dataPanel(allocation.segments[frame].name, original[frame].tokens + ' tokens before policy', applied ? 'Apply the chosen context policy while preserving system instructions, the question, and reserved output.' : 'Inspect the input budget before applying any overflow policy.', allocation.segments[frame].tokens + ' tokens retained / reserved', 'memory') + Atlas.notice(overflow ? 'Still over capacity' : 'Fits the selected context budget', overflow ? 'Exceeds the limit by ' + overflow + ' tokens. If protected content alone is too large, increase capacity or reduce instructions/output reservation.' : 'Input + reserved output fit. A larger window does not guarantee reliable use of every token.', overflow ? 'error' : 'storage') + '<p class="sim-caption">Summarization here is an assumed 65% conversation reduction, not a live summary. Any lossy strategy can remove useful information.</p>';
      root.querySelector('#context-metrics').innerHTML = Atlas.metric('Original budget', originalTotal + ' tokens', 'data') + Atlas.metric('Effective budget', total + ' tokens', 'data') + Atlas.metric('Removed / compressed', allocation.dropped + ' tokens', 'compute') + Atlas.metric('Overflow', overflow + ' tokens', overflow ? 'error' : 'storage');
      root.dataset.contextTotal = total;
      root.dataset.contextOverflow = overflow;
    } });
    root.addEventListener('input', () => { applied = false; player.draw(); });
    root.addEventListener('change', () => { applied = false; player.draw(); });
    root.querySelector('#apply-context').addEventListener('click', () => { applied = true; player.draw(); });
    player.reset = () => { applied = false; player.seek(0); };
    player.draw();
    return player;
  };
})();