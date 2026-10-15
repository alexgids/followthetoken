(function () {
  'use strict';
  const Atlas = window.AIAtlas;
  const math = Atlas.math;
  const escape = Atlas.escape;
  const sentence = ['The', 'animal', "didn't", 'cross', 'the', 'road', 'because', 'it', 'was', 'tired'];
  const states = [[0.2, 0.1], [1.8, 1.4], [-0.4, 0.2], [0.2, -0.5], [0.2, 0.1], [0.3, 0.2], [0.5, 0.6], [0.8, 0.6], [0.1, 0.2], [0.7, 0.3]];
  const project = (vector, matrix) => matrix.map(row => math.dot(vector, row));
  function bars(labels, probabilities, selected = -1, color = 'data') {
    return '<div class="mini-bars">' + labels.map((label, index) => '<div class="bar-row ' + (selected === index ? 'selected' : '') + '"><span>' + escape(label) + '</span><div class="bar-track"><div class="bar-fill" style="--bar-color:var(--' + color + ');width:' + probabilities[index] * 100 + '%"></div></div><output>' + Atlas.format(probabilities[index] * 100, 1) + '%</output></div>').join('') + '</div>';
  }
  Atlas.simulations.transformer = (root) => {
    const panels = Atlas.layout(root, Atlas.select('norm-placement', 'Block architecture', [['pre', 'Pre-norm (common modern pattern)'], ['post', 'Post-norm (original pattern)']], 'pre') + Atlas.slider('block-count', 'Transformer blocks N', 32, 1, 96, 1));
    const player = Atlas.createPlayer({ length: 16, onFrame(frame) {
      const pre = root.querySelector('#norm-placement').value === 'pre';
      const blocks = Number(root.querySelector('#block-count').value);
      const stages = [
        ['Input text', 'HUMAN LANGUAGE', 'tokens', 'data'], ['Tokenizer', 'TEXT TO PIECES', 'tokens', 'compute'], ['Token IDs', 'VOCABULARY INDICES', 'tokens', 'data'], ['Token embeddings', 'LEARNED LOOKUP', 'embeddings', 'model'],
        ['Position mechanism', 'RoPE / ABSOLUTE / RELATIVE', 'position', 'model'],
        [pre ? 'Normalization' : 'Multi-head attention', pre ? 'PRE-NORM' : 'CAUSAL TOKEN MIXING', pre ? 'residual' : 'multihead', 'model'],
        [pre ? 'Multi-head attention' : 'Residual addition', pre ? 'CAUSAL TOKEN MIXING' : 'INPUT + ATTENTION', pre ? 'multihead' : 'residual', 'model'],
        [pre ? 'Residual addition' : 'Normalization', pre ? 'INPUT + ATTENTION' : 'POST-NORM', 'residual', 'compute'],
        [pre ? 'Normalization' : 'Feed-forward network', pre ? 'PRE-NORM' : 'POSITION-WISE COMPUTE', pre ? 'residual' : 'ffn', 'model'],
        [pre ? 'Feed-forward network' : 'Residual addition', pre ? 'POSITION-WISE COMPUTE' : 'STATE + FFN', pre ? 'ffn' : 'residual', 'model'],
        [pre ? 'Residual addition' : 'Normalization', pre ? 'STATE + FFN' : 'POST-NORM', 'residual', 'compute'],
        ['Repeat ' + blocks + ' blocks', 'NEW WEIGHTS PER BLOCK', 'transformer', 'model'],
        ['Final norm + head', 'VOCABULARY PROJECTION', 'sampling', 'compute'], ['Logits', 'UNNORMALIZED SCORES', 'sampling', 'data'], ['Probabilities', 'SOFTMAX + DECODING', 'sampling', 'decision'], ['Next token', 'APPEND AND REPEAT', 'forward', 'data']
      ];
      const positions = stages.map((_, index) => { const row = Math.floor(index / 4); const column = row % 2 ? 3 - index % 4 : index % 4; return { x: 40 + column * 218, y: 40 + row * 137 }; });
      let drawing = '<rect class="model-zone" x="22" y="149" width="867" height="281"/><text class="zone-label" x="41" y="165">TRANSFORMER BLOCK / ' + (pre ? 'PRE-NORM' : 'POST-NORM') + '</text>';
      drawing += positions.slice(1).map((position, index) => { const previous = positions[index]; const path = previous.y === position.y ? position.x > previous.x ? 'M' + (previous.x + 172) + ',' + (previous.y + 36) + ' H' + (position.x - 6) : 'M' + previous.x + ',' + (previous.y + 36) + ' H' + (position.x + 178) : 'M' + (previous.x + 86) + ',' + (previous.y + 72) + ' V' + (position.y - 6); return Atlas.edge(path, index < frame); }).join('');
      drawing += Atlas.edge(pre ? 'M780,249 V272 H126 V255' : 'M780,249 V272 H344 V255', frame >= 7, 'RESIDUAL SKIP', 459, 267);
      drawing += Atlas.edge(pre ? 'M126,249 V290 H863 V414 H562 V392' : 'M126,386 V414 H344 V392', frame >= 10, 'RESIDUAL SKIP', pre ? 641 : 170, 410);
      drawing += stages.map(([label, sub, route, color], index) => Atlas.node({ id: String(index), label, sub, ...positions[index], color, active: index === frame, done: index < frame })).join('');
      Atlas.paint(panels.visual, Atlas.svg(drawing, 920, 595, 'A clickable decoder-only transformer architecture with residual skip paths'));
      const current = stages[frame];
      const related = Atlas.byId[current[2]];
      panels.inspector.innerHTML = Atlas.dataPanel(current[0], frame ? escape(stages[frame - 1][0]) : 'A sequence of text', escape(related.technical), frame === 15 ? 'One selected vocabulary token' : 'A tensor or metadata passed to the next component', current[2]) + '<div class="parameter-lock">' + Atlas.icon('lock-keyhole') + 'PARAMETERS FIXED AT INFERENCE</div>' + Atlas.notice('Position is architecture-dependent', 'RoPE rotates Q/K inside attention. Absolute embeddings add input vectors. This node represents the positional mechanism, not one universal operation.', 'model');
    } });
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    root.addEventListener('input', () => player.draw());
    root.addEventListener('change', () => player.draw());
    player.draw();
    return player;
  };
  Atlas.simulations.attention = (root) => {
    const initialQuery = project(states[7], [[1.4, 0.3], [0.1, 1.2]]);
    const controls = Atlas.slider('query-first', 'Query coordinate 1', Atlas.format(initialQuery[0]), -3, 3, 0.02) + Atlas.slider('query-second', 'Query coordinate 2', Atlas.format(initialQuery[1]), -3, 3, 0.02) + Atlas.slider('key-scale', 'Key projection scale', 1, 0.1, 2, 0.05) + Atlas.slider('value-scale', 'Value projection scale', 1, 0.1, 2, 0.05);
    const panels = Atlas.layout(root, controls, '<div class="metrics-row" id="attention-metrics"></div>');
    panels.visual.classList.add('content-visual');
    let selected = 7;
    const phases = ['Choose a token', 'Project X into Q / K / V', 'Multiply Q by K transpose', 'Scale and apply causal mask', 'Softmax scores', 'Mix value vectors', 'Output representation'];
    const player = Atlas.createPlayer({ length: phases.length, onFrame(frame) {
      const query = [Number(root.querySelector('#query-first').value), Number(root.querySelector('#query-second').value)];
      const keyScale = Number(root.querySelector('#key-scale').value);
      const valueScale = Number(root.querySelector('#value-scale').value);
      const queries = states.map(state => project(state, [[1.4, 0.3], [0.1, 1.2]]));
      queries[selected] = query;
      const keys = states.map(state => project(state, [[keyScale, 0], [0, keyScale]]));
      const values = states.map(state => project(state, [[0.6 * valueScale, -0.2 * valueScale], [0.3 * valueScale, 0.8 * valueScale]]));
      const raw = keys.map(key => math.dot(query, key));
      const attention = math.attention(query, keys, values, selected + 1);
      let calculation = '';
      if (frame === 0) calculation = Atlas.matrix(states, 'X / toy token states', selected) + '<div class="operation-description">These are hand-designed two-dimensional states, not embeddings from a real model.</div>';
      if (frame === 1) calculation = Atlas.matrix(queries, 'Q = X Wq', selected) + Atlas.matrix(keys, 'K = X Wk', selected) + Atlas.matrix(values, 'V = X Wv', selected);
      if (frame === 2) calculation = Atlas.matrix([query], 'Q / selected row') + '<span class="operation-symbol">&times;</span>' + Atlas.matrix([keys.map(key => key[0]), keys.map(key => key[1])], 'K transpose') + '<span class="operation-symbol">=</span>' + Atlas.matrix([raw], 'Dot-product scores');
      if (frame === 3) calculation = Atlas.matrix([raw], 'Raw scores') + '<div class="operation-description">Divide by sqrt(2), then replace future-position scores with negative infinity.</div>' + Atlas.matrix([attention.scores], 'Scaled + masked scores');
      if (frame === 4) calculation = Atlas.matrix([attention.scores], 'Scaled + masked scores') + '<span class="operation-symbol">&rarr;</span>' + Atlas.matrix([attention.weights], 'Softmax weights', -1, true);
      if (frame === 5) calculation = Atlas.matrix([attention.weights], 'Weights') + '<span class="operation-symbol">&times;</span>' + Atlas.matrix(values, 'Value vectors V') + '<span class="operation-symbol">=</span>' + Atlas.matrix([attention.output], 'Weighted output');
      if (frame === 6) calculation = '<div class="output-vector"><span class="tiny-label">NEW REPRESENTATION FOR "' + escape(sentence[selected]) + '"</span>' + Atlas.vector(attention.output, 'model') + '<p class="sim-caption">This is a weighted mixture, not a copy of one selected word.</p></div>';
      panels.visual.innerHTML = '<div class="attention-sentence">' + sentence.map((token, index) => '<button class="attention-token ' + (index === selected ? 'active' : index > selected ? 'masked' : '') + '" data-attention-token="' + index + '" title="Inspect attention from position ' + index + '">' + escape(token) + '</button>').join('') + '</div><div class="badge-line"><span class="group-dot" style="background:var(--model)"></span>' + phases[frame].toUpperCase() + '</div><div class="matrix-operations">' + calculation + '</div><div class="attention-strip">' + sentence.map((token, index) => '<div class="attention-strip-cell" style="--attention-weight:' + attention.weights[index] + '"><span>' + escape(token) + '</span><strong>' + Atlas.format(attention.weights[index] * 100, 1) + '%</strong></div>').join('') + '</div>' + Atlas.linearDiagram(['Q / K / V', 'Scores', 'Causal mask', 'Softmax', 'Weighted V', 'Output'], Math.max(0, frame - 1), 'model');
      Atlas.attachZoom(panels.visual);
      const largest = attention.weights.indexOf(Math.max(...attention.weights));
      panels.inspector.innerHTML = Atlas.dataPanel('"' + sentence[selected] + '" attends to context', Atlas.vector(query, 'data'), phases[frame] + '<br>Future positions are masked for this causal decoder.', 'Strongest weight: <strong>' + escape(sentence[largest]) + '</strong><br>' + Atlas.format(attention.weights[largest] * 100, 1) + '%', 'kv') + bars(sentence, attention.weights, selected) + '<p class="sim-caption">Edit Q activations or K/V projection scales. Patterns are illustrative, not a faithful explanation of a real model.</p>';
      root.querySelector('#attention-metrics').innerHTML = Atlas.metric('Query position', selected, 'data') + Atlas.metric('Visible keys', selected + 1, 'model') + Atlas.metric('Weight sum', Atlas.format(attention.weights.reduce((sum, value) => sum + value, 0), 3), 'data') + Atlas.metric('Output vector', attention.output.map(value => Atlas.format(value)).join(' / '), 'model');
      root.dataset.attentionWeights = JSON.stringify(attention.weights);
      root.dataset.attentionOutput = JSON.stringify(attention.output);
    } });
    root.addEventListener('click', event => {
      const token = event.target.closest('[data-attention-token]');
      if (token) {
        selected = Number(token.dataset.attentionToken);
        const query = project(states[selected], [[1.4, 0.3], [0.1, 1.2]]);
        for (const [axis, value] of [['first', query[0]], ['second', query[1]]]) { root.querySelector('#query-' + axis).value = value; root.querySelector('#query-' + axis + '-value').value = Atlas.format(value); }
        player.draw();
      }
      const stage = event.target.closest('[data-node]');
      if (stage) player.seek(Math.min(6, Number(stage.dataset.node) + 1));
    });
    root.addEventListener('input', () => player.draw());
    player.draw();
    return player;
  };
  Atlas.simulations.heads = (root) => {
    const patterns = [
      ['Local pattern', 'Nearby previous positions', index => -Math.abs(7 - index) * 0.65],
      ['Subject-like pattern', 'Hand-built emphasis on animal', index => index === 1 ? 2.6 : 0.2],
      ['Long-range pattern', 'Hand-built early-position emphasis', index => index < 3 ? 1.8 : -0.3],
      ['Diffuse pattern', 'A broad mixture', () => 0]
    ];
    const panels = Atlas.layout(root, '<div class="button-segments head-segments">' + patterns.map((head, index) => '<button data-head="' + index + '" ' + (!index ? 'class="active"' : '') + '>' + 'Head ' + (index + 1) + '</button>').join('') + '</div>');
    let selectedHead = 0;
    const player = Atlas.createPlayer({ length: 7, onFrame(frame) {
      const outputs = patterns.map(pattern => { const weights = math.softmax(sentence.map((_, index) => index <= 7 ? pattern[2](index) : -Infinity)); return { weights, values: states[0].map((_, coordinate) => weights.reduce((sum, weight, index) => sum + weight * states[index][coordinate], 0)) }; });
      let drawing = Atlas.node({ id: 'input', label: 'Token states', sub: 'ONE SHARED INPUT', x: 25, y: 231, width: 150, color: 'data', active: frame === 0 });
      for (let index = 0; index < 4; index++) {
        drawing += Atlas.edge('M175,267 H205 V' + (70 + index * 123) + ' H245', frame >= 1);
        drawing += Atlas.node({ id: 'head-' + index, label: 'Head ' + (index + 1), sub: patterns[index][0].toUpperCase(), x: 250, y: 34 + index * 123, width: 200, color: 'model', active: index === selectedHead, badge: '2D' });
        drawing += Atlas.edge('M450,' + (70 + index * 123) + ' H510 V267 H550', frame >= 5);
      }
      drawing += Atlas.node({ id: 'concat', label: 'Concatenate', sub: '4 HEADS x 2 = 8', x: 555, y: 231, width: 155, color: 'compute', active: frame === 5 });
      drawing += Atlas.edge('M710,267 H748', frame >= 6) + Atlas.node({ id: 'project', label: 'Projection', sub: '8 TO 2 FEATURES', x: 753, y: 231, width: 135, color: 'model', active: frame === 6 });
      const concatenated = outputs.flatMap(head => head.values);
      const projected = [math.dot(concatenated, [0.3, 0.1, 0.25, -0.1, 0.2, 0.15, 0.1, 0.05]), math.dot(concatenated, [-0.1, 0.3, 0.05, 0.25, 0.1, 0.2, 0.05, 0.15])];
      drawing += '<text class="diagram-note" x="25" y="554">PATTERNS ARE CONCEPTUAL; REAL HEADS HAVE NO GUARANTEED NAMED ROLE.</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 930, 580, 'Four parallel attention heads concatenated and projected'));
      panels.inspector.innerHTML = '<div class="inspector-heading"><span class="tiny-label">SELECTED HEAD</span><h3>' + patterns[selectedHead][0] + '</h3></div><p class="sim-caption">' + patterns[selectedHead][1] + '. Constructed toy weights.</p>' + bars(sentence, outputs[selectedHead].weights, -1, 'model') + '<h4>HEAD OUTPUT</h4>' + Atlas.vector(outputs[selectedHead].values) + '<h4>AFTER CONCAT + PROJECTION</h4>' + Atlas.vector(projected, 'compute') + '<a class="inspect-link" href="#kv">GQA reduces K/V cache heads ' + Atlas.icon('arrow-up-right') + '</a>';
      root.querySelectorAll('[data-head]').forEach(button => button.classList.toggle('active', Number(button.dataset.head) === selectedHead));
    } });
    root.addEventListener('click', event => {
      const head = event.target.closest('[data-head]');
      if (head) { selectedHead = Number(head.dataset.head); player.seek(1 + selectedHead); }
      const node = event.target.closest('[data-node]');
      if (node?.dataset.node.startsWith('head-')) { selectedHead = Number(node.dataset.node.split('-')[1]); player.seek(1 + selectedHead); }
      else if (node) player.seek(node.dataset.node === 'concat' ? 5 : node.dataset.node === 'project' ? 6 : 0);
    });
    player.draw();
    return player;
  };
  Atlas.simulations.ffn = (root) => {
    const controls = Atlas.slider('ffn-first', 'State coordinate 1', 0.8, -2, 2, 0.1) + Atlas.slider('ffn-second', 'State coordinate 2', -0.4, -2, 2, 0.1) + Atlas.slider('ffn-scale', 'Expansion weight scale', 1, 0.1, 2, 0.1) + Atlas.select('ffn-activation', 'Nonlinearity', [['relu', 'ReLU'], ['silu', 'SiLU / Swish']], 'relu');
    const panels = Atlas.layout(root, controls, '<div class="ffn-distinction"><div><span class="group-dot" style="background:var(--data)"></span><strong>Attention</strong><span>Communication between tokens</span></div><div><span class="group-dot" style="background:var(--model)"></span><strong>FFN</strong><span>Computation within each token state</span></div></div>');
    const player = Atlas.createPlayer({ length: 5, onFrame(frame) {
      const input = [Number(root.querySelector('#ffn-first').value), Number(root.querySelector('#ffn-second').value)];
      const scale = Number(root.querySelector('#ffn-scale').value);
      const firstWeights = [[1, 0.5], [-0.6, 0.9], [0.8, -0.7], [-0.4, -0.8]].map(row => row.map(value => value * scale));
      const secondWeights = [[0.6, -0.3, 0.8, 0.2], [-0.4, 0.7, -0.2, 0.6]];
      const expanded = project(input, firstWeights).map((value, index) => value + [0.1, -0.2, 0.05, 0.15][index]);
      const activation = root.querySelector('#ffn-activation').value;
      const hidden = expanded.map(value => activation === 'relu' ? math.relu(value) : value * math.sigmoid(value));
      const output = project(hidden, secondWeights).map((value, index) => value + [0.05, -0.05][index]);
      panels.visual.innerHTML = Atlas.linearDiagram([{ label: 'Token state', sub: '2 FEATURES', color: 'data' }, { label: 'Linear expansion', sub: '2 TO 4 FEATURES', color: 'compute' }, { label: activation === 'relu' ? 'ReLU activation' : 'SiLU activation', sub: 'NONLINEAR TRANSFORM', color: 'model' }, { label: 'Linear contraction', sub: '4 TO 2 FEATURES', color: 'compute' }, { label: 'New token state', sub: 'NO CROSS-TOKEN MIXING', color: 'model' }], frame, 'model') + '<div class="ffn-tensors">' + [['Input x', input, 'data'], ['W1 x + b1', expanded, 'compute'], ['Activation', hidden, 'model'], ['W2 h + b2', output, 'model']].map(([label, values, color]) => '<div><span class="tiny-label">' + label + '</span>' + Atlas.vector(values, color) + '</div>').join('') + '</div>';
      Atlas.attachZoom(panels.visual);
      panels.inspector.innerHTML = Atlas.dataPanel(['Read token state', 'Expand features', 'Apply nonlinearity', 'Contract features', 'Return state'][frame], Atlas.vector(input, 'data'), 'The same learned weights process every token independently. Attention already supplied context.', Atlas.vector(output, 'model'), 'moe') + '<h4>W1 / EXPANSION</h4>' + Atlas.matrix(firstWeights, '4 rows, 2 columns') + '<h4>W2 / CONTRACTION</h4>' + Atlas.matrix(secondWeights, '2 rows, 4 columns') + '<p class="sim-caption">SiLU here is a plain activation. SwiGLU adds a separate learned gate; it is not the same operation.</p>';
      root.dataset.ffnOutput = JSON.stringify(output);
    } });
    root.addEventListener('input', () => player.draw());
    root.addEventListener('change', () => player.draw());
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.draw();
    return player;
  };
  Atlas.simulations.residual = (root) => {
    const panels = Atlas.layout(root, Atlas.slider('residual-scale', 'Sublayer contribution', 1, 0, 2, 0.1) + Atlas.select('norm-kind', 'Normalization', [['layer', 'LayerNorm'], ['rms', 'RMSNorm']], 'layer') + '<label class="checkbox-field"><input id="residual-enabled" type="checkbox" checked>Residual connection</label>', '<div class="metrics-row" id="norm-metrics"></div>');
    const input = [1, 4, -2, 3];
    const player = Atlas.createPlayer({ length: 4, onFrame(frame) {
      const branch = [-0.2, 0.6, 1, -0.5].map(value => value * Number(root.querySelector('#residual-scale').value));
      const residual = root.querySelector('#residual-enabled').checked;
      const sum = branch.map((value, index) => value + (residual ? input[index] : 0));
      const rms = root.querySelector('#norm-kind').value === 'rms';
      const normalized = math.normalize(sum, rms);
      let drawing = Atlas.node({ id: '0', label: 'Input x', sub: 'KEEP AN IDENTITY PATH', x: 35, y: 204, width: 162, color: 'data', active: frame === 0 }) + Atlas.node({ id: '1', label: 'Sublayer F(x)', sub: 'LEARN A CHANGE', x: 290, y: 62, width: 195, color: 'model', active: frame === 1 });
      drawing += Atlas.edge('M197,240 H245 V98 H284', frame >= 1) + Atlas.edge('M485,98 H582 V207', frame >= 2);
      if (residual) drawing += Atlas.edge('M197,240 H548', frame >= 2, 'IDENTITY / SKIP', 267, 224);
      drawing += '<circle cx="582" cy="240" r="28" fill="var(--surface)" stroke="var(--compute)" stroke-width="2"/><text x="582" y="248" text-anchor="middle" fill="var(--compute)" font-size="24">+</text>';
      drawing += Atlas.edge('M610,240 H663', frame >= 3) + Atlas.node({ id: '3', label: rms ? 'RMSNorm' : 'LayerNorm', sub: 'CONTROL FEATURE SCALE', x: 669, y: 204, width: 170, color: 'compute', active: frame === 3 });
      drawing += '<text class="diagram-note" x="35" y="369">RESIDUAL: ' + (residual ? 'x + F(x)' : 'F(x) ONLY') + '</text><text class="diagram-note" x="35" y="392">POST-NORM SHOWN HERE. PRE-NORM MOVES NORMALIZATION BEFORE F.</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 885, 438, 'A residual identity path added to a sublayer, followed by normalization'));
      panels.inspector.innerHTML = Atlas.dataPanel(['Input', 'Sublayer', 'Residual sum', 'Normalize'][frame], Atlas.vector(input, 'data'), 'F(x)' + Atlas.vector(branch) + (residual ? 'x + F(x)' : 'Residual disabled') + Atlas.vector(sum, 'compute'), Atlas.vector(normalized, 'storage'), 'transformer') + '<p class="sim-caption">Gamma = 1, beta = 0, epsilon = 0.00001 for this calculation. Learned scale/shift can change these output statistics.</p>';
      const mean = normalized.reduce((total, value) => total + value, 0) / normalized.length;
      const squareMean = normalized.reduce((total, value) => total + value ** 2, 0) / normalized.length;
      root.querySelector('#norm-metrics').innerHTML = Atlas.metric('Normalized mean', Atlas.format(mean, 4), 'data') + Atlas.metric('Normalized RMS', Atlas.format(Math.sqrt(squareMean), 4), 'storage') + Atlas.metric('Residual path', residual ? 'Enabled' : 'Disabled', residual ? 'storage' : 'error');
      root.dataset.normalized = JSON.stringify(normalized);
    } });
    root.addEventListener('input', () => player.draw());
    root.addEventListener('change', () => player.draw());
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.draw();
    return player;
  };
  Atlas.simulations.position = (root) => {
    const controls = Atlas.select('position-order', 'Sentence order', [['dog', 'Dog bites man'], ['man', 'Man bites dog']], 'dog') + Atlas.select('position-mode', 'Position mechanism', [['rope', 'RoPE / rotary Q-K'], ['sin', 'Sinusoidal encoding'], ['absolute', 'Learned absolute (toy)']], 'rope') + Atlas.slider('position-index', 'Inspected position', 1, 0, 2, 1);
    const panels = Atlas.layout(root, controls);
    const player = Atlas.createPlayer({ length: 4, onFrame(frame) {
      const order = root.querySelector('#position-order').value === 'dog' ? ['Dog', 'bites', 'man'] : ['Man', 'bites', 'dog'];
      const position = Number(root.querySelector('#position-index').value);
      const mode = root.querySelector('#position-mode').value;
      const rotation = position * 0.6;
      const vector = [1, 0.4];
      const rotated = [vector[0] * Math.cos(rotation) - vector[1] * Math.sin(rotation), vector[0] * Math.sin(rotation) + vector[1] * Math.cos(rotation)];
      let drawing = order.map((word, index) => Atlas.node({ id: String(index), label: word, sub: 'POSITION ' + index, x: 90 + index * 220, y: 36, width: 170, height: 70, color: index === position ? 'model' : 'data', active: index === position })).join('');
      if (mode === 'rope') {
        const center = [425, 310];
        drawing += '<circle cx="425" cy="310" r="140" fill="none" stroke="var(--line)"/><path class="chart-axis" d="M265,310 H585 M425,150 V470"/>';
        drawing += '<path d="M425,310 L' + (center[0] + vector[0] * 100) + ',' + (center[1] - vector[1] * 100) + '" stroke="var(--data)" stroke-width="2.5"/><path d="M425,310 L' + (center[0] + rotated[0] * 100) + ',' + (center[1] - rotated[1] * 100) + '" stroke="var(--model)" stroke-width="3"/>';
        drawing += '<text class="chart-label" x="90" y="145">ONE 2D Q/K PAIR</text><text class="diagram-note" x="90" y="492">BLUE: ORIGINAL VECTOR / PURPLE: POSITION-ROTATED VECTOR</text>';
      } else if (mode === 'sin') {
        for (let pair = 0; pair < 3; pair++) {
          const frequency = 0.4 / 2 ** pair;
          const path = Array.from({ length: 161 }, (_, index) => { const pos = index / 10; return (index ? 'L' : 'M') + (90 + pos * 39) + ',' + (205 + pair * 85 - Math.sin(pos * frequency) * 29); }).join(' ');
          drawing += '<path d="' + path + '" fill="none" stroke="var(--' + ['data', 'model', 'storage'][pair] + ')" stroke-width="2"/>';
        }
        drawing += '<path stroke="var(--compute)" stroke-dasharray="4 4" d="M' + (90 + position * 39) + ',158 V428"/><text class="diagram-note" x="90" y="486">ILLUSTRATIVE WAVES AT DIFFERENT FREQUENCIES; REAL ENCODINGS HAVE MANY PAIRS.</text>';
      } else {
        drawing += '<text class="chart-title" x="90" y="171">Token identity + learned position row</text>';
        const identities = { dog: [0.3, 0.8], man: [0.8, 0.2], bites: [-0.3, 0.6] };
        order.forEach((word, index) => {
          const identity = identities[word.toLowerCase()];
          const positional = [[0.1, 0.4], [0.5, -0.2], [-0.3, 0.6]][index];
          const output = identity.map((value, coordinate) => value + positional[coordinate]);
          drawing += '<text class="chart-label" x="' + (90 + index * 220) + '" y="218">[' + identity.join(', ') + ']</text><text class="chart-label" x="' + (90 + index * 220) + '" y="259">+ [' + positional.join(', ') + ']</text><text class="chart-title" x="' + (90 + index * 220) + '" y="311">[' + output.map(value => Atlas.format(value, 1)).join(', ') + ']</text>';
        });
        drawing += '<text class="diagram-note" x="90" y="399">HAND-DESIGNED VECTORS, NOT VALUES FROM TRAINED WEIGHTS.</text>';
      }
      Atlas.paint(panels.visual, Atlas.svg(drawing, 850, 520, 'Order-sensitive tokens with rotary, sinusoidal, or absolute positional information'));
      panels.inspector.innerHTML = Atlas.dataPanel(order[position] + ' at position ' + position, mode === 'rope' ? Atlas.vector(vector, 'data') : 'Token identity and position index', mode === 'rope' ? 'Rotate Q/K pair by ' + Atlas.format(rotation) + ' radians in this toy example.' : mode === 'sin' ? 'Use position-dependent sin/cos values at multiple frequencies.' : 'Add a learned absolute position vector.', mode === 'rope' ? Atlas.vector(rotated, 'model') : 'Order-sensitive input to attention', 'attention') + Atlas.notice('Relative relationships', 'With RoPE, query/key dot products depend on the difference between their positions. It does not mean a token embedding is literally rotated at the model input.', 'model');
    } });
    root.addEventListener('input', () => player.draw());
    root.addEventListener('change', () => player.draw());
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) { root.querySelector('#position-index').value = node.dataset.node; root.querySelector('#position-index-value').value = node.dataset.node; player.draw(); } });
    player.draw();
    return player;
  };
  Atlas.simulations.sampling = (root) => {
    const cities = ['Paris', 'London', 'Berlin', 'Madrid', 'Rome', 'Lisbon', 'Vienna', 'Other'];
    const logits = [3.8, 1.6, 1.15, 0.65, 0.25, 0.1, -0.1, -0.4];
    const controls = Atlas.slider('temperature', 'Temperature', 1, 0, 2.5, 0.05) + Atlas.slider('top-k', 'Top-k', 8, 1, 8, 1) + Atlas.slider('top-p', 'Top-p', 1, 0.05, 1, 0.05) + '<button class="small-button" id="sample-token">' + Atlas.icon('shuffle') + 'Sample token</button>';
    const panels = Atlas.layout(root, controls, '<div class="metrics-row" id="sample-metrics"></div>');
    panels.visual.classList.add('content-visual');
    const counts = cities.map(() => 0);
    let selected = -1;
    const player = Atlas.createPlayer({ length: 5, onFrame(frame) {
      const temperature = Number(root.querySelector('#temperature').value);
      const topK = Number(root.querySelector('#top-k').value);
      const topP = Number(root.querySelector('#top-p').value);
      const probabilities = math.distribution(logits, temperature, topK, topP);
      const maximumLogit = Math.max(...logits);
      let drawing = '<text class="chart-title" x="50" y="34">Vocabulary logits</text><text class="chart-title" x="421" y="34">Filtered sampling distribution</text>';
      cities.forEach((city, index) => {
        const y = 70 + index * 42;
        drawing += '<text class="chart-label" x="50" y="' + (y + 14) + '">' + city + '</text><rect x="124" y="' + y + '" width="' + ((logits[index] - Math.min(...logits)) / (maximumLogit - Math.min(...logits)) * 215) + '" height="18" fill="var(--surface-alt)"/><text class="chart-label" x="346" y="' + (y + 14) + '">' + Atlas.format(logits[index]) + '</text>';
        drawing += '<rect x="421" y="' + y + '" width="272" height="18" fill="var(--surface-alt)"/><rect x="421" y="' + y + '" width="' + (probabilities[index] * 272) + '" height="18" fill="var(--' + (selected === index ? 'decision' : 'data') + ')"/><text class="chart-label" x="709" y="' + (y + 14) + '">' + Atlas.format(probabilities[index] * 100, 1) + '%</text>';
      });
      drawing += '<text class="diagram-note" x="50" y="425">LOGIT BAR LENGTHS SHIFTED FOR DISPLAY; THE NUMERIC SCORES ARE USED BY SOFTMAX.</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 805, 452, 'Logits and probabilities modified by temperature, top-k, and top-p'));
      const total = counts.reduce((sum, count) => sum + count, 0);
      panels.inspector.innerHTML = Atlas.dataPanel(['Project hidden state', 'Read logits', 'Temperature + softmax', 'Top-k / top-p', 'Select token'][frame], 'Eight synthetic logits', temperature === 0 ? 'Temperature 0 selects the largest logit deterministically.' : 'Temperature &rarr; top-k &rarr; top-p &rarr; renormalize', selected >= 0 ? '<strong>' + cities[selected] + '</strong>' : 'No sample yet', 'forward') + '<h4>OBSERVED SAMPLES / ' + total + '</h4>' + bars(cities, counts.map(count => total ? count / total : 0), selected, 'decision') + '<p class="sim-caption">Finite sample frequencies differ from target probabilities. This is not the full LLM vocabulary.</p>';
      root.querySelector('#sample-metrics').innerHTML = Atlas.metric('Probability sum', Atlas.format(probabilities.reduce((sum, probability) => sum + probability, 0), 3), 'data') + Atlas.metric('Retained candidates', probabilities.filter(probability => probability > 0).length, 'decision') + Atlas.metric('Selected token', selected >= 0 ? cities[selected] : 'None', 'decision');
      root.dataset.probabilities = JSON.stringify(probabilities);
    } });
    root.querySelector('#sample-token').addEventListener('click', () => { selected = math.sample(JSON.parse(root.dataset.probabilities)); counts[selected]++; player.seek(4); });
    root.addEventListener('input', () => { selected = -1; counts.fill(0); player.draw(); });
    player.draw();
    return player;
  };
  Atlas.simulations.forward = (root) => {
    const presets = {
      france: { prompt: 'What is the capital of France?', answer: 'Paris is the capital of France.' },
      transformer: { prompt: 'What is a transformer?', answer: 'A transformer uses attention and feed-forward networks.' }
    };
    const controls = '<label class="input-label forward-prompt" for="forward-prompt"><span>YOUR QUESTION</span><input class="sim-text-input" id="forward-prompt" maxlength="1000" value="' + presets.france.prompt + '"></label>' + Atlas.select('forward-preset', 'Example', [['france', 'Capital of France'], ['transformer', 'A transformer'], ['custom', 'Custom text / offline fixture']], 'france');
    const panels = Atlas.layout(root, controls, '<div class="generated-response"><div class="response-label"><span class="tiny-label">GENERATED RESPONSE</span><span class="fixture-badge">SCRIPTED EXAMPLE / REAL TOKENIZATION</span></div><div class="response-text" id="generated-text" aria-live="polite"><span class="response-placeholder">Waiting for the first token</span></div><div class="response-stats" id="response-stats"></div></div>');
    if (Atlas.state.route === 'home') root.classList.add('home-simulation');
    const stages = [
      { label: 'Human language', sub: 'PROMPT + CONTEXT', color: 'data', route: 'tokens' },
      { label: 'Tokens', sub: 'BYTE-PAIR ENCODING', color: 'data', route: 'tokens' },
      { label: 'Token IDs', sub: 'VOCABULARY INDICES', color: 'data', route: 'tokens' },
      { label: 'Embeddings', sub: 'NUMERICAL VECTORS', color: 'model', route: 'embeddings' },
      { label: 'Transformer', sub: 'REPEATED BLOCKS', color: 'model', route: 'transformer' },
      { label: 'Attention', sub: 'MIX TOKEN INFORMATION', color: 'model', route: 'attention' },
      { label: 'Feed-forward', sub: 'TRANSFORM EACH STATE', color: 'compute', route: 'ffn' },
      { label: 'Logits', sub: 'NEXT-TOKEN SCORES', color: 'compute', route: 'sampling' },
      { label: 'Probabilities', sub: 'DECODING DISTRIBUTION', color: 'decision', route: 'sampling' },
      { label: 'Next token', sub: 'SELECT + APPEND', color: 'decision', route: 'sampling' },
      { label: 'KV cache', sub: 'REUSE PAST KEYS / VALUES', color: 'storage', route: 'kv' },
      { label: 'Response', sub: 'STREAM + STOP', color: 'data', route: 'inference' }
    ];
    let inputTokens;
    let answerTokens;
    let sequence;
    let answer;
    function prepare() {
      const prompt = root.querySelector('#forward-prompt').value;
      const fixture = Object.values(presets).find(item => item.prompt.toLowerCase() === prompt.trim().toLowerCase());
      answer = fixture ? fixture.answer : 'This is an offline visualization, not a live language model.';
      inputTokens = Atlas.tokenize(prompt);
      answerTokens = Atlas.tokenize(answer);
      sequence = [];
      for (let token = 0; token < answerTokens.ids.length; token++) {
        for (let stage = token === 0 ? 0 : 3; stage <= 10; stage++) sequence.push({ token, stage });
      }
      sequence.push({ token: answerTokens.ids.length - 1, stage: 11 });
    }
    prepare();
    const player = Atlas.createPlayer({ length: sequence.length, interval: 420, onFrame(frame) {
      const current = sequence[frame];
      const stage = current.stage;
      const produced = stage >= 9 ? current.token + 1 : current.token;
      const currentId = answerTokens.ids[current.token];
      const currentPiece = answerTokens.pieces[current.token];
      const lastInputId = current.token ? answerTokens.ids[current.token - 1] : inputTokens.ids.at(-1) || 0;
      const vector = Array.from({ length: 4 }, (_, index) => Math.sin(lastInputId * 0.003 + index * 0.7));
      let diagram = Atlas.linearDiagram(stages.map(({ route, ...rest }) => rest), stage, 'data');
      diagram = diagram.replace('</g></svg>', '<path class="flow-edge" d="M476,350 H450 V155 H780 V255" stroke-dasharray="4 4"/><text class="diagram-note" x="443" y="145">NEXT DECODE STEP / REUSE K,V</text></g></svg>');
      Atlas.paint(panels.visual, diagram);
      const displays = [
        [escape(root.querySelector('#forward-prompt').value), 'Read the prompt and any application-provided context.', inputTokens.ids.length + ' input tokens'],
        [escape(root.querySelector('#forward-prompt').value), 'Split text with the real cl100k_base tokenizer.', '<code>' + escape(inputTokens.pieces.slice(0, 14).join(' | ')) + '</code>'],
        ['Token pieces', 'Map each piece to its fixed vocabulary ID.', '<code>[' + inputTokens.ids.slice(0, 14).join(', ') + ']</code>'],
        ['Token ID ' + lastInputId, 'Look up a learned embedding row. Coordinates below are a toy illustration.', Atlas.vector(vector)],
        ['Embedding / current token state', 'Evaluate repeated blocks with fixed parameters; prefill once, then cached decode.', 'Contextual hidden state'],
        ['Current token query plus prior keys/values', 'Compute causal attention and mix value vectors.', 'A contextualized token representation'],
        ['Attention-updated representation', 'Apply shared position-wise nonlinear transformations and residual paths.', 'Final hidden state for this position'],
        ['Last-position hidden state', 'Project to vocabulary scores. This fixture scripts the output token.', 'Highest fixture candidate: <strong>' + escape(currentPiece) + '</strong>'],
        ['Synthetic next-token scores', 'Apply softmax and a decoding policy. These are not live model predictions.', '<strong>' + escape(currentPiece) + '</strong> / illustrative 72% candidate'],
        ['A next-token distribution', 'Select one token and append it to the sequence.', '<strong>' + escape(currentPiece) + '</strong><br>Vocabulary ID ' + currentId],
        ['Existing per-layer K/V tensors', 'Reuse K/V for the positions already evaluated. The just-selected token enters the blocks on the next decode step.', 'Cached positions evaluated so far: ' + (inputTokens.ids.length + current.token)],
        ['A completed generated sequence', 'Stream the selected tokens and stop at the fixture boundary.', '<strong>' + escape(answer) + '</strong>']
      ];
      panels.inspector.innerHTML = '<div class="badge-line"><span class="group-dot" style="background:var(--' + (current.token ? 'storage' : 'data') + ')"></span>' + (current.token ? 'DECODE' : 'PREFILL + FIRST TOKEN') + '</div>' + Atlas.dataPanel(stages[stage].label, ...displays[stage], stages[stage].route) + '<div class="parameter-lock">' + Atlas.icon('lock-keyhole') + 'MODEL WEIGHTS DO NOT CHANGE</div>';
      const tokens = answerTokens.ids.slice(0, produced);
      root.querySelector('#generated-text').innerHTML = tokens.length ? '<span class="generated-token">' + escape(window.GPTTokenizer_cl100k_base.decode(tokens)) + '</span>' + (stage === 11 ? '' : '<span class="token-cursor" aria-hidden="true"></span>') : '<span class="response-placeholder">Waiting for the first token</span>';
      root.querySelector('#response-stats').innerHTML = '<span>' + inputTokens.ids.length + ' prompt tokens</span><span>' + produced + ' / ' + answerTokens.ids.length + ' response tokens</span><span>' + (current.token ? 'Only the new token is computed; cached K/V supplies history.' : 'Prompt positions are processed in prefill.') + '</span>';
      root.dataset.generatedCount = produced;
      root.dataset.stage = stage;
      root.dataset.answer = answer;
    } });
    root.addEventListener('click', event => {
      const node = event.target.closest('[data-node]');
      if (node) {
        const stage = Number(node.dataset.node);
        const token = sequence[player.frame].token;
        const target = stage === 11 ? sequence.length - 1 : sequence.findIndex(item => item.token === token && item.stage === stage);
        if (target >= 0) player.seek(target);
      }
    });
    root.querySelector('#forward-prompt').addEventListener('input', () => { root.querySelector('#forward-preset').value = 'custom'; prepare(); player.length = sequence.length; player.seek(0); });
    root.querySelector('#forward-preset').addEventListener('change', event => { if (presets[event.target.value]) root.querySelector('#forward-prompt').value = presets[event.target.value].prompt; prepare(); player.length = sequence.length; player.seek(0); });
    player.draw();
    return player;
  };
})();