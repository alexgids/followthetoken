(function () {
  'use strict';
  const Atlas = window.AIAtlas;
  const math = Atlas.math;
  const escape = Atlas.escape;
  Atlas.neuralForward = (inputs, firstWeights, secondWeights, bias, activation = 'relu') => {
    const preactivations = firstWeights.map((row, index) => math.dot(row, inputs) + bias[index]);
    const hidden = preactivations.map(activation === 'sigmoid' ? math.sigmoid : math.relu);
    const logits = secondWeights.map((row, index) => math.dot(row, hidden) + (index ? -0.1 : 0.1));
    return { preactivations, hidden, logits, probabilities: math.softmax(logits) };
  };
  Atlas.simulations.hierarchy = (root, topic) => {
    const panels = Atlas.layout(root);
    const layers = [
      ['AI', 'A broad field', 'A rule-based expert system can be AI without learning from data.', 'ai'],
      ['Machine learning', 'Learn from examples', 'Supervised, unsupervised, self-supervised, and reinforcement learning are learning setups, not successive layers.', 'training'],
      ['Deep learning', 'Multilayer neural networks', 'Deep learning can be supervised, self-supervised, unsupervised, or reinforcement learning.', 'neural'],
      ['Neural networks', 'A learned function', 'Weights and biases parameterize layers; activations depend on each input.', 'neural'],
      ['Transformers', 'One neural architecture', 'Attention and FFNs transform contextual token representations.', 'transformer'],
      ['Foundation models', 'Broad pretraining', 'This describes training scope and adaptability, not one required architecture.', 'training'],
      ['LLMs', 'Language-focused models', 'Large language models are a family of models, not the entire AI field.', 'forward']
    ];
    const player = Atlas.createPlayer({ length: layers.length, onFrame(frame) {
      let drawing = '<rect class="model-zone" x="225" y="122" width="620" height="150"/><text class="zone-label" x="243" y="144">LEARNING SETUPS: OVERLAPPING WITH ARCHITECTURE CHOICES</text>';
      const positions = [{ x: 405, y: 20 }, { x: 405, y: 100 }, { x: 405, y: 300 }, { x: 405, y: 393 }, { x: 405, y: 486 }, { x: 695, y: 393 }, { x: 695, y: 486 }];
      drawing += Atlas.edge('M405,56 H116 V125', false, 'HAND-WRITTEN RULES', 92, 92);
      drawing += Atlas.node({ id: 'rules', label: 'Rule-based systems', sub: 'IF / THEN LOGIC', x: 30, y: 130, color: 'decision' });
      drawing += Atlas.edge('M491,172 V294', frame >= 2);
      drawing += '<text class="diagram-note" x="508" y="290">architecture choice</text>';
      for (const [index, name] of ['Supervised', 'Unsupervised', 'Self-supervised', 'Reinforcement'].entries()) {
        drawing += Atlas.node({ id: 'method-' + index, label: name, sub: ['LABELED TARGETS', 'DATA STRUCTURE', 'DERIVED TARGETS', 'ENVIRONMENT REWARD'][index], x: 240 + index * 148, y: 182, width: 137, height: 65, color: index === 3 ? 'decision' : 'compute' });
      }
      drawing += Atlas.edge('M491,92 V94', frame >= 1) + Atlas.edge('M491,372 V387', frame >= 3) + Atlas.edge('M491,465 V480', frame >= 4) + Atlas.edge('M577,429 H689', frame >= 5, 'COMMON ARCHITECTURE', 590, 417) + Atlas.edge('M781,465 V480', frame >= 6);
      drawing += '<text class="diagram-note" x="696" y="587">Foundation-model status is not</text><text class="diagram-note" x="696" y="604">a subset of transformer architecture.</text>';
      drawing += layers.map((layer, index) => Atlas.node({ id: String(index), label: layer[0], sub: layer[1].toUpperCase(), ...positions[index], color: index < 3 ? 'data' : 'model', active: index === frame, done: index < frame })).join('');
      Atlas.paint(panels.visual, Atlas.svg(drawing, 920, 635, 'AI hierarchy with learning setups separate from architecture choices'));
      panels.inspector.innerHTML = Atlas.dataPanel(layers[frame][0], frame ? layers[frame - 1][0] : 'A task requiring useful behavior', layers[frame][1], layers[frame][2], layers[frame][3]);
    } });
    root.addEventListener('click', event => {
      const node = event.target.closest('[data-node]');
      if (!node) return;
      if (/^\d+$/.test(node.dataset.node)) {
        player.seek(Number(node.dataset.node));
        const svg = panels.visual.querySelector('svg');
        const scale = 1 + player.frame * 0.045;
        if (svg?.atlasZoom) window.d3.select(svg).call(svg.atlasZoom.transform, window.d3.zoomIdentity.translate(-460 * (scale - 1), -player.frame * 10).scale(scale));
      } else panels.inspector.innerHTML = Atlas.notice(node.dataset.node === 'rules' ? 'Rules are AI, not necessarily ML' : 'Learning setups are not a single hierarchy', node.dataset.node === 'rules' ? 'Example: if a measured temperature exceeds a limit, trigger an alert. No learned parameters are required.' : topic.example, 'compute');
      Atlas.icons();
    });
    player.draw();
    return player;
  };
  Atlas.simulations.neural = (root) => {
    const firstWeights = [[0.8, 0.4], [-0.6, 0.9], [0.7, -0.8]];
    const secondWeights = [[0.6, -0.4, 0.9], [-0.5, 0.8, -0.3]];
    const edgeOptions = [];
    firstWeights.forEach((row, neuron) => row.forEach((_, input) => edgeOptions.push(['first-' + neuron + '-' + input, 'Input ' + (input + 1) + ' to hidden ' + (neuron + 1)])));
    secondWeights.forEach((row, output) => row.forEach((_, hidden) => edgeOptions.push(['second-' + output + '-' + hidden, 'Hidden ' + (hidden + 1) + ' to output ' + (output + 1)])));
    const controls = Atlas.slider('nn-input-1', 'Input 1', 0.8, -2, 2, 0.1) + Atlas.slider('nn-input-2', 'Input 2', -0.3, -2, 2, 0.1) + Atlas.select('nn-activation', 'Activation', [['relu', 'ReLU'], ['sigmoid', 'Sigmoid']], 'relu');
    const panels = Atlas.layout(root, controls, '<div class="metrics-row" id="nn-metrics"></div>');
    const parameters = Atlas.select('nn-edge', 'Selected weight', edgeOptions, edgeOptions[0][0]) + Atlas.slider('nn-weight', 'Weight value', 0.8, -2, 2, 0.05) + Atlas.slider('nn-bias', 'Hidden bias offset', 0, -1, 1, 0.05);
    let selectedEdge = 'first-0-0';
    const player = Atlas.createPlayer({ length: 5, onFrame(frame) {
      const inputs = [Number(root.querySelector('#nn-input-1').value), Number(root.querySelector('#nn-input-2').value)];
      const biasOffset = Number(root.querySelector('#nn-bias')?.value || 0);
      const bias = [0.1 + biasOffset, -0.2 + biasOffset, 0.05 + biasOffset];
      const activation = root.querySelector('#nn-activation').value;
      const result = Atlas.neuralForward(inputs, firstWeights, secondWeights, bias, activation);
      const inputPositions = [{ x: 100, y: 150 }, { x: 100, y: 310 }];
      const hiddenPositions = [{ x: 350, y: 105 }, { x: 350, y: 230 }, { x: 350, y: 355 }];
      const outputPositions = [{ x: 630, y: 150 }, { x: 630, y: 310 }];
      let drawing = '<text class="chart-label" x="100" y="48" text-anchor="middle">INPUT</text><text class="chart-label" x="350" y="48" text-anchor="middle">HIDDEN LAYER</text><text class="chart-label" x="630" y="48" text-anchor="middle">OUTPUT LOGITS</text>';
      function edge(from, to, value, id, lit) {
        return '<g class="weight-edge" role="button" tabindex="0" data-weight="' + id + '" aria-label="Set weight ' + id + '"><title>Weight ' + Atlas.format(value) + '</title><path d="M' + (from.x + 34) + ',' + from.y + ' L' + (to.x - 34) + ',' + to.y + '" stroke="' + (value < 0 ? 'var(--error)' : 'var(--data)') + '" stroke-width="' + (1 + Math.abs(value) * 2) + '" opacity="' + (selectedEdge === id ? 1 : lit ? 0.65 : 0.18) + '"/><path d="M' + (from.x + 34) + ',' + from.y + ' L' + (to.x - 34) + ',' + to.y + '" stroke="transparent" stroke-width="18"/></g>';
      }
      firstWeights.forEach((row, hidden) => row.forEach((weight, input) => { drawing += edge(inputPositions[input], hiddenPositions[hidden], weight, 'first-' + hidden + '-' + input, frame >= 1); }));
      secondWeights.forEach((row, output) => row.forEach((weight, hidden) => { drawing += edge(hiddenPositions[hidden], outputPositions[output], weight, 'second-' + output + '-' + hidden, frame >= 3); }));
      function neurons(positions, values, labels, color, lit) {
        return positions.map((position, index) => '<g><circle cx="' + position.x + '" cy="' + position.y + '" r="34" fill="' + (lit ? 'color-mix(in srgb,var(--' + color + ') 8%,var(--surface))' : 'var(--surface)') + '" stroke="var(--' + color + ')" stroke-width="' + (lit ? '2' : '1') + '"/><text class="neuron-value" x="' + position.x + '" y="' + (position.y + 5) + '">' + Atlas.format(values[index]) + '</text><text class="neuron-label" x="' + position.x + '" y="' + (position.y + 54) + '">' + labels[index] + '</text></g>').join('');
      }
      drawing += neurons(inputPositions, inputs, ['x1', 'x2'], 'data', true) + neurons(hiddenPositions, frame < 2 ? result.preactivations : result.hidden, ['h1', 'h2', 'h3'], 'model', frame >= 1) + neurons(outputPositions, result.logits, ['z1', 'z2'], 'compute', frame >= 3);
      drawing += '<text class="diagram-note" x="64" y="420">BLUE: POSITIVE WEIGHT</text><text class="diagram-note" x="330" y="420">RED: NEGATIVE WEIGHT</text><text class="diagram-note" x="615" y="420">17 PARAMETERS</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 760, 450, 'An editable two-input three-hidden two-output neural network'));
      const existing = panels.inspector.querySelector('.parameter-fields');
      if (!existing) {
        panels.inspector.innerHTML = '<div class="inspector-heading"><span class="tiny-label">LEARNED PARAMETERS</span><h3>The selected connection</h3></div><div class="parameter-fields">' + parameters + '</div><div id="nn-detail"></div>';
        Atlas.bindInputs(panels.inspector);
      }
      const stages = ['Read input values', 'Weighted sum + bias', 'Apply activation', 'Project to logits', 'Softmax output'];
      panels.inspector.querySelector('#nn-detail').innerHTML = '<h4>' + stages[frame].toUpperCase() + '</h4><p class="sim-caption">Hidden preactivation</p>' + Atlas.vector(result.preactivations, 'compute') + '<p class="sim-caption">After ' + activation + '</p>' + Atlas.vector(result.hidden) + '<div class="mini-bars">' + result.probabilities.map((probability, index) => '<div class="bar-row"><span>Output ' + (index + 1) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + probability * 100 + '%"></div></div><output>' + Atlas.format(probability * 100, 1) + '%</output></div>').join('') + '</div><p class="sim-caption">Values are actual computations in this toy network.</p>';
      root.querySelector('#nn-metrics').innerHTML = Atlas.metric('Parameters', '17', 'model') + Atlas.metric('Hidden activations', result.hidden.map(value => Atlas.format(value, 1)).join(' / '), 'model') + Atlas.metric('Probability sum', Atlas.format(result.probabilities.reduce((sum, value) => sum + value, 0), 3), 'data');
      root.dataset.probabilities = JSON.stringify(result.probabilities);
    } });
    root.addEventListener('input', event => {
      if (event.target.id === 'nn-weight') {
        const [layer, row, column] = selectedEdge.split('-');
        (layer === 'first' ? firstWeights : secondWeights)[Number(row)][Number(column)] = Number(event.target.value);
      }
      player.draw();
    });
    function selectEdge(id) {
      selectedEdge = id;
      const [layer, row, column] = id.split('-');
      const value = (layer === 'first' ? firstWeights : secondWeights)[Number(row)][Number(column)];
      panels.inspector.querySelector('#nn-edge').value = id;
      panels.inspector.querySelector('#nn-weight').value = value;
      panels.inspector.querySelector('#nn-weight-value').value = value;
      player.draw();
    }
    root.addEventListener('change', event => { if (event.target.id === 'nn-edge') selectEdge(event.target.value); else player.draw(); });
    root.addEventListener('click', event => { const edge = event.target.closest('[data-weight]'); if (edge) selectEdge(edge.dataset.weight); });
    player.draw();
    return player;
  };
  Atlas.gradientHistory = (rate, length = 21, initial = -1) => {
    const history = [{ weight: initial, loss: (initial - 2) ** 2 }];
    for (let index = 1; index < length; index++) {
      const weight = math.gradientStep(history[index - 1].weight, rate);
      history.push({ weight, loss: (weight - 2) ** 2 });
    }
    return history;
  };
  Atlas.simulations.gradient = (root) => {
    const controls = Atlas.slider('learning-rate', 'Learning rate', 0.2, 0.01, 1.25, 0.01) + Atlas.select('learning-example', 'Step-size example', [['custom', 'Custom'], ['small', 'Too small: 0.01'], ['balanced', 'Reasonable: 0.20'], ['large', 'Too large: 1.20']], 'balanced') + '<label class="checkbox-field"><input type="checkbox" id="validation-toggle">Illustrative validation curve</label>';
    const panels = Atlas.layout(root, controls, '<div class="metrics-row" id="gd-metrics"></div>');
    const player = Atlas.createPlayer({ length: 21, interval: 650, onFrame(frame) {
      const rate = Number(root.querySelector('#learning-rate').value);
      const history = Atlas.gradientHistory(rate);
      const current = history[frame];
      const parameterX = value => 70 + (value + 2) / 8 * 300;
      const parameterY = loss => 335 - Math.min(18, loss) / 18 * 260;
      const historyX = index => 500 + index / 20 * 290;
      const historyY = loss => 335 - Math.min(36, loss) / 36 * 260;
      const parabola = Array.from({ length: 81 }, (_, index) => { const value = -2 + index / 10; return [parameterX(value), parameterY((value - 2) ** 2)]; });
      const path = points => points.map((point, index) => (index ? 'L' : 'M') + point[0] + ',' + point[1]).join(' ');
      let drawing = '<text class="chart-title" x="70" y="37">Loss landscape</text><text class="chart-title" x="500" y="37">Training progress</text>';
      for (let index = 0; index <= 4; index++) drawing += '<path class="chart-grid" d="M70,' + (75 + index * 65) + ' H370 M500,' + (75 + index * 65) + ' H790"/>';
      drawing += '<path class="chart-axis" d="M70,75 V335 H370 M500,75 V335 H790"/><path class="chart-line" d="' + path(parabola) + '"/><path stroke="var(--error)" stroke-width="2.5" fill="none" d="' + path(history.slice(0, frame + 1).map((item, index) => [historyX(index), historyY(item.loss)])) + '"/>';
      drawing += '<circle cx="' + parameterX(Math.max(-2, Math.min(6, current.weight))) + '" cy="' + parameterY(current.loss) + '" r="7" fill="var(--compute)"/><circle cx="' + historyX(frame) + '" cy="' + historyY(current.loss) + '" r="5" fill="var(--error)"/>';
      drawing += '<text class="chart-label" x="210" y="373">parameter w</text><text class="chart-label" x="620" y="373">optimizer step</text><text class="chart-label" x="70" y="354">-2</text><text class="chart-label" x="217" y="354">2</text><text class="chart-label" x="360" y="354">6</text><text class="chart-label" x="500" y="354">0</text><text class="chart-label" x="775" y="354">20</text><text class="chart-label" x="465" y="84">36</text><text class="chart-label" x="474" y="335">0</text><text class="chart-label" x="37" y="84">18</text>';
      if (root.querySelector('#validation-toggle').checked) {
        const validation = history.slice(0, frame + 1).map((_, index) => [historyX(index), historyY(1.2 + 0.08 * (index - 6) ** 2)]);
        drawing += '<path class="chart-target" d="' + path(validation) + '"/><text class="diagram-note" x="500" y="413">GREEN: ILLUSTRATIVE VALIDATION, NOT THIS MODEL\'S DATA</text>';
      }
      if (current.loss > 36 || current.weight < -2 || current.weight > 6) drawing += '<text class="diagram-note" fill="var(--error)" x="70" y="410">CURRENT POINT EXCEEDS PLOT RANGE</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 850, 445, 'Gradient descent on a quadratic loss with a training-loss history'));
      const slope = 2 * (current.weight - 2);
      panels.inspector.innerHTML = Atlas.dataPanel('Step ' + frame, 'w = <strong>' + Atlas.format(current.weight, 4) + '</strong>', 'gradient = 2(w - 2)<br><strong>' + Atlas.format(slope, 4) + '</strong><br>next w = w - ' + rate + ' &times; gradient', 'next w = <strong>' + Atlas.format(math.gradientStep(current.weight, rate), 4) + '</strong>', 'training') + Atlas.notice(rate >= 1 ? 'Unstable / non-convergent' : rate <= 0.03 ? 'Small steps' : 'Converging', rate >= 1 ? 'For this loss, rate 1 oscillates and rate above 1 increases error. Other objectives have different stability limits.' : rate <= 0.03 ? 'The direction is correct, but many updates are needed.' : 'The weight moves toward 2, the loss minimum.', rate >= 1 ? 'error' : 'storage');
      root.querySelector('#gd-metrics').innerHTML = Atlas.metric('Weight', Atlas.format(current.weight, 4), 'model') + Atlas.metric('Training loss', Atlas.format(current.loss, 4), 'error') + Atlas.metric('Prediction at x = 1', Atlas.format(current.weight, 4), 'data') + Atlas.metric('Target at x = 1', '2.0000', 'storage');
      root.dataset.loss = current.loss;
    } });
    root.addEventListener('input', () => player.seek(0));
    root.addEventListener('change', event => {
      if (event.target.id === 'learning-example' && event.target.value !== 'custom') {
        const rate = { small: 0.01, balanced: 0.2, large: 1.2 }[event.target.value];
        root.querySelector('#learning-rate').value = rate;
        root.querySelector('#learning-rate-value').value = rate;
        player.seek(0);
      } else player.draw();
    });
    player.draw();
    return player;
  };
  Atlas.simulations.tokens = (root) => {
    const controls = '<label class="input-label token-input-label" for="token-input"><span>TEXT / CL100K_BASE BPE</span><textarea class="sim-text-input" id="token-input" rows="2" maxlength="5000">The cat is sitting on the mat</textarea></label>';
    const panels = Atlas.layout(root, controls, '<div class="metrics-row" id="token-metrics"></div>');
    panels.visual.classList.add('content-visual');
    let encoding = Atlas.tokenize(root.querySelector('#token-input').value);
    const player = Atlas.createPlayer({ length: Math.max(1, encoding.ids.length), onFrame(frame) {
      const id = encoding.ids[frame];
      panels.visual.innerHTML = '<div class="badge-line"><span class="group-dot" style="background:var(--data)"></span>REAL BYTE-PAIR ENCODING <span class="encoding-name">100,256 mergeable pieces</span></div><div class="token-strip">' + encoding.pieces.slice(0, 300).map((piece, index) => '<button class="token-piece ' + (frame === index ? 'active' : '') + '" data-token="' + index + '" title="Select token ' + index + '"><span>' + escape(piece || '[empty]') + '</span><small>ID ' + encoding.ids[index] + '</small></button>').join('') + '</div>' + (!encoding.ids.length ? Atlas.notice('No input tokens', 'Enter text to encode.', 'data') : '') + (encoding.ids.length > 300 ? '<p class="sim-caption">First 300 pieces shown; count and playback include all tokens.</p>' : '') + Atlas.linearDiagram([{ label: 'Text', sub: 'UTF-8 BYTES', color: 'data' }, { label: 'BPE tokenizer', sub: 'FIXED VOCABULARY', color: 'compute' }, { label: 'Token IDs', sub: 'INTEGER INDICES', color: 'data' }, { label: 'Embedding lookup', sub: 'LEARNED VECTORS', color: 'model' }], Math.min(3, frame), 'data');
      Atlas.attachZoom(panels.visual);
      const embedding = id === undefined ? [] : [Math.sin(id * 0.013), Math.cos(id * 0.007), Math.sin(id * 0.021), Math.cos(id * 0.011)];
      panels.inspector.innerHTML = Atlas.dataPanel(id === undefined ? 'Empty input' : 'Token ' + (frame + 1), '<code>' + escape(encoding.pieces[frame] || '') + '</code>', 'The fixed vocabulary assigns a piece an integer ID. An embedding table uses that ID as a row index.', id === undefined ? 'No token' : '<strong>ID ' + id + '</strong>' + Atlas.vector(embedding), 'embeddings') + Atlas.notice('Illustrative embedding, real ID', 'The four coordinates are deterministic illustration values, not a trained embedding. Individually decoded byte fragments can contain replacement characters; the full sequence decodes correctly.', 'model');
      root.querySelector('#token-metrics').innerHTML = Atlas.metric('Tokens', encoding.ids.length, 'data') + Atlas.metric('Characters (code points)', [...root.querySelector('#token-input').value].length, 'data') + Atlas.metric('Full round-trip', encoding.decoded === root.querySelector('#token-input').value ? 'Exact' : 'Mismatch', 'storage');
      root.dataset.tokenIds = JSON.stringify(encoding.ids);
    } });
    root.querySelector('#token-input').addEventListener('input', event => {
      encoding = Atlas.tokenize(event.target.value);
      player.length = Math.max(1, encoding.ids.length);
      player.seek(0);
    });
    root.addEventListener('click', event => { const token = event.target.closest('[data-token]'); if (token) player.seek(Number(token.dataset.token)); });
    player.draw();
    return player;
  };
  Atlas.simulations.embeddings = (root) => {
    const points = [
      { word: 'king', vector: [0.25, 0.85], color: 'model' }, { word: 'queen', vector: [0.42, 0.89], color: 'model' },
      { word: 'man', vector: [0.22, 0.57], color: 'model' }, { word: 'woman', vector: [0.43, 0.58], color: 'model' },
      { word: 'dog', vector: [-0.6, 0.44], color: 'storage' }, { word: 'cat', vector: [-0.59, 0.64], color: 'storage' },
      { word: 'car', vector: [-0.65, -0.5], color: 'data' }, { word: 'truck', vector: [-0.77, -0.71], color: 'data' },
      { word: 'apple', vector: [0.38, -0.65], color: 'compute' }, { word: 'banana', vector: [0.71, -0.63], color: 'compute' }
    ];
    const options = points.map(point => [point.word, point.word]);
    const controls = Atlas.select('embedding-a', 'Compare vector A', options, 'king') + Atlas.select('embedding-b', 'With vector B', options, 'queen') + Atlas.slider('embedding-x', 'Vector B / coordinate 1', 0.42, -1, 1, 0.01) + Atlas.slider('embedding-y', 'Vector B / coordinate 2', 0.89, -1, 1, 0.01);
    const panels = Atlas.layout(root, controls, '<div class="metrics-row" id="embedding-metrics"></div>');
    const player = Atlas.createPlayer({ length: 4, onFrame(frame) {
      const first = points.find(point => point.word === root.querySelector('#embedding-a').value);
      const second = points.find(point => point.word === root.querySelector('#embedding-b').value);
      const coordinateX = value => 370 + value * 285;
      const coordinateY = value => 250 - value * 205;
      let drawing = '';
      for (let index = -2; index <= 2; index++) drawing += '<path class="chart-grid" d="M85,' + coordinateY(index / 2) + ' H655 M' + coordinateX(index / 2) + ',45 V455"/>';
      drawing += '<path class="chart-axis" d="M85,250 H655 M370,45 V455"/><text class="chart-label" x="505" y="483">Illustrative coordinate 1</text><text class="chart-label" x="85" y="25">Illustrative coordinate 2</text>';
      if (frame >= 1) drawing += '<path d="M370,250 L' + coordinateX(first.vector[0]) + ',' + coordinateY(first.vector[1]) + '" stroke="var(--model)" stroke-width="2" fill="none"/>';
      if (frame >= 2) drawing += '<path d="M370,250 L' + coordinateX(second.vector[0]) + ',' + coordinateY(second.vector[1]) + '" stroke="var(--data)" stroke-width="2" fill="none"/>';
      drawing += points.map(point => '<g class="embedding-point" data-word="' + point.word + '" role="button" tabindex="0" aria-label="Compare ' + point.word + '"><title>' + point.word + ': [' + point.vector.map(value => Atlas.format(value)).join(', ') + ']</title><circle cx="' + coordinateX(point.vector[0]) + '" cy="' + coordinateY(point.vector[1]) + '" r="' + ([first.word, second.word].includes(point.word) ? 7 : 5) + '" fill="var(--' + point.color + ')" stroke="var(--surface)" stroke-width="2"/><text class="chart-title" x="' + (coordinateX(point.vector[0]) + 11) + '" y="' + (coordinateY(point.vector[1]) + 4) + '" font-size="11">' + point.word + '</text></g>').join('');
      Atlas.paint(panels.visual, Atlas.svg(drawing, 760, 505, 'An editable illustrative two-dimensional embedding space'));
      const similarity = math.cosine(first.vector, second.vector);
      const zeroVector = !Math.hypot(...first.vector) || !Math.hypot(...second.vector);
      panels.inspector.innerHTML = Atlas.dataPanel(['The vector space', 'Vector A', 'Vector B', 'Cosine comparison'][frame], first.word + Atlas.vector(first.vector, 'model'), 'Compare vector directions with a normalized dot product.', second.word + Atlas.vector(second.vector, 'data') + '<strong>cosine = ' + (zeroVector ? 'undefined for zero vector' : Atlas.format(similarity, 4)) + '</strong>', 'rag') + Atlas.notice('Two dimensions, hand-placed points', 'Real vectors can have hundreds or thousands of dimensions. These axes and positions do not come from a trained embedding model.', 'model');
      root.querySelector('#embedding-metrics').innerHTML = Atlas.metric('Illustrative dimensions', '2', 'model') + Atlas.metric('Dot product', Atlas.format(math.dot(first.vector, second.vector), 4), 'compute') + Atlas.metric('Cosine similarity', zeroVector ? 'Undefined' : Atlas.format(similarity, 4), 'data');
      root.dataset.similarity = similarity;
    } });
    function chooseSecond(word) {
      const point = points.find(item => item.word === word);
      root.querySelector('#embedding-b').value = word;
      for (const [axis, value] of [['x', point.vector[0]], ['y', point.vector[1]]]) { root.querySelector('#embedding-' + axis).value = value; root.querySelector('#embedding-' + axis + '-value').value = value; }
      player.draw();
    }
    root.addEventListener('input', event => {
      if (event.target.id.startsWith('embedding-')) {
        const point = points.find(item => item.word === root.querySelector('#embedding-b').value);
        point.vector = [Number(root.querySelector('#embedding-x').value), Number(root.querySelector('#embedding-y').value)];
        player.draw();
      }
    });
    root.addEventListener('change', event => { if (event.target.id === 'embedding-b') chooseSecond(event.target.value); else player.draw(); });
    root.addEventListener('click', event => { const point = event.target.closest('[data-word]'); if (point) chooseSecond(point.dataset.word); });
    player.draw();
    return player;
  };
})();