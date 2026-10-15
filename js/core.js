(function () {
  'use strict';
  const Atlas = window.AIAtlas = {};
  Atlas.escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  Atlas.read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem('ai-atlas-' + key)) ?? fallback; } catch { return fallback; }
  };
  Atlas.write = (key, value) => {
    try { localStorage.setItem('ai-atlas-' + key, JSON.stringify(value)); } catch { return false; }
    return true;
  };
  Atlas.state = { route: 'home', theme: Atlas.read('theme', 'light'), progress: Atlas.read('progress', {}), level: Atlas.read('level', 'intuition'), mathematics: Atlas.read('mathematics', false) };
  document.documentElement.dataset.theme = Atlas.state.theme;
  Atlas.navigate = route => { location.hash = route; };
  Atlas.icon = (name, className = '') => '<i data-lucide="' + name + '" class="' + className + '" aria-hidden="true"></i>';
  Atlas.icons = () => window.lucide?.createIcons({ attrs: { 'stroke-width': 1.6 } });
  Atlas.format = (value, digits = 2) => Number.isFinite(value) ? Number(value).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : 'not finite';
  Atlas.math = {
    dot: (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0),
    relu: value => Math.max(0, value),
    sigmoid: value => 1 / (1 + Math.exp(-value)),
    softmax: values => {
      const maximum = Math.max(...values);
      if (maximum === -Infinity) return values.map(() => 0);
      const exponential = values.map(value => Math.exp(value - maximum));
      const denominator = exponential.reduce((sum, value) => sum + value, 0);
      return exponential.map(value => value / denominator);
    },
    cosine: (left, right) => {
      const denominator = Math.hypot(...left) * Math.hypot(...right);
      return denominator ? Atlas.math.dot(left, right) / denominator : 0;
    },
    normalize: (values, rms = false) => {
      const mean = rms ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
      return values.map(value => (value - mean) / Math.sqrt(variance + 1e-5));
    },
    attention: (query, keys, values, allowed = keys.length) => {
      const scores = keys.map((key, index) => index < allowed ? Atlas.math.dot(query, key) / Math.sqrt(query.length) : -Infinity);
      const weights = Atlas.math.softmax(scores);
      const output = values[0].map((_, coordinate) => weights.reduce((sum, weight, index) => sum + weight * values[index][coordinate], 0));
      return { scores, weights, output };
    },
    distribution: (logits, temperature, topK, topP) => {
      const ordered = logits.map((logit, index) => ({ logit, index })).sort((left, right) => right.logit - left.logit);
      if (temperature === 0) return logits.map((_, index) => index === ordered[0].index ? 1 : 0);
      const scaled = logits.map(logit => logit / temperature);
      const keep = new Set(ordered.slice(0, topK).map(item => item.index));
      const probabilities = Atlas.math.softmax(scaled.map((logit, index) => keep.has(index) ? logit : -Infinity));
      const ranking = probabilities.map((probability, index) => ({ probability, index })).filter(item => item.probability > 0).sort((left, right) => right.probability - left.probability);
      let cumulative = 0;
      const nucleus = new Set();
      for (const item of ranking) {
        nucleus.add(item.index);
        cumulative += item.probability;
        if (cumulative >= topP) break;
      }
      const mass = probabilities.reduce((sum, probability, index) => sum + (nucleus.has(index) ? probability : 0), 0);
      return probabilities.map((probability, index) => nucleus.has(index) ? probability / mass : 0);
    },
    sample: (probabilities, random = Math.random()) => {
      let cumulative = 0;
      for (let index = 0; index < probabilities.length; index++) {
        cumulative += probabilities[index];
        if (random < cumulative) return index;
      }
      return probabilities.length - 1;
    },
    seed: seed => {
      let current = seed >>> 0;
      return () => { current = (1664525 * current + 1013904223) >>> 0; return current / 4294967296; };
    },
    gradientStep: (weight, rate) => weight - rate * 2 * (weight - 2),
    weightMemory: (parameters, bytes, devices) => ({ totalGB: parameters * bytes / 1e9, shardGB: parameters * bytes / devices / 1e9 }),
    kvMemory: (layers, kvHeads, headDimension, tokens, bytes, batch = 1) => 2 * layers * kvHeads * headDimension * tokens * bytes * batch,
    quantize: (values, bits) => {
      if (bits >= 16) return { values: [...values], error: 0, scale: 0, integers: null };
      const maximum = Math.max(...values.map(Math.abs));
      const limit = 2 ** (bits - 1) - 1;
      const scale = maximum / limit || 1;
      const integers = values.map(value => Math.max(-limit, Math.min(limit, Math.round(value / scale))));
      const reconstructed = integers.map(value => value * scale);
      const error = values.reduce((sum, value, index) => sum + (value - reconstructed[index]) ** 2, 0) / values.length;
      return { values: reconstructed, error, scale, integers };
    }
  };
  Atlas.tokenize = text => {
    const tokenizer = window.GPTTokenizer_cl100k_base;
    if (!tokenizer) throw new Error('The local tokenizer library did not load.');
    const ids = tokenizer.encode(text, { disallowedSpecial: new Set() });
    return { ids, pieces: ids.map(id => tokenizer.decode([id])), decoded: tokenizer.decode(ids) };
  };
  Atlas.renderMath = root => {
    root.querySelectorAll('[data-math]').forEach(element => {
      if (window.katex) window.katex.render(element.dataset.math, element, { throwOnError: false, displayMode: true, strict: false });
      else element.textContent = element.dataset.math;
    });
  };
  Atlas.equation = expression => '<div class="equation" data-math="' + Atlas.escape(expression) + '"></div>';
  Atlas.button = (name, icon, attrs = '') => '<button class="icon-button" title="' + name + '" aria-label="' + name + '" ' + attrs + '>' + Atlas.icon(icon) + '</button>';
  Atlas.slider = (id, label, value, min, max, step = 1, suffix = '') => '<label class="slider-field" for="' + id + '"><span>' + label + '<output id="' + id + '-value">' + value + suffix + '</output></span><input id="' + id + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" data-suffix="' + suffix + '"></label>';
  Atlas.select = (id, label, options, selected) => '<label class="select-field" for="' + id + '"><span>' + label + '</span><select id="' + id + '">' + options.map(option => '<option value="' + Atlas.escape(option[0]) + '" ' + (String(option[0]) === String(selected) ? 'selected' : '') + '>' + Atlas.escape(option[1]) + '</option>').join('') + '</select></label>';
  Atlas.metric = (label, value, color = 'data') => '<div class="metric" style="--metric-color:var(--' + color + ')"><span>' + label + '</span><strong>' + value + '</strong></div>';
  Atlas.chip = (value, color = 'data') => '<span class="number-chip" style="--chip-color:var(--' + color + ')">' + Atlas.escape(value) + '</span>';
  Atlas.vector = (values, color = 'model') => '<div class="vector-values">' + values.map(value => Atlas.chip(Atlas.format(value), color)).join('') + '</div>';
  Atlas.notice = (title, text, color = 'data') => '<div class="notice" style="--notice-color:var(--' + color + ')"><strong>' + title + '</strong><span>' + text + '</span></div>';
  Atlas.matrix = (rows, label, activeRow = -1, heat = false) => '<div class="matrix-wrap"><span class="matrix-label">' + label + '</span><div class="matrix" style="--columns:' + rows[0].length + '">' + rows.map((row, rowIndex) => row.map(value => '<span class="matrix-cell ' + (rowIndex === activeRow ? 'selected' : '') + '" ' + (heat ? 'style="background:color-mix(in srgb,var(--data) ' + (Math.max(0, Math.min(1, value)) * 70) + '%,var(--surface))"' : '') + '>' + (value === -Infinity ? '&#8722;&#8734;' : Atlas.format(value)) + '</span>').join('')).join('') + '</div></div>';
  let diagramSerial = 0;
  Atlas.svg = (content, width = 900, height = 430, label = 'Interactive concept diagram', zoom = true) => {
    diagramSerial++;
    return '<svg class="' + (zoom ? 'zoomable' : 'chart-svg') + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + Atlas.escape(label) + '"><defs><marker id="arrow-' + diagramSerial + '" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="var(--muted)"/></marker></defs><g class="zoom-layer">' + content.replaceAll('url(#arrow)', 'url(#arrow-' + diagramSerial + ')') + '</g></svg>';
  };
  Atlas.wrap = (text, characters = 22) => {
    const words = text.split(' ');
    const lines = [''];
    for (const word of words) {
      if ((lines[lines.length - 1] + ' ' + word).trim().length > characters && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + word).trim();
    }
    return lines;
  };
  Atlas.node = ({ id, label, sub = '', x, y, width = 172, height = 72, color = 'data', active = false, done = false, route = '', badge = '' }) => {
    const lines = Atlas.wrap(label, Math.floor((width - 28) / 7.1));
    const labelTop = sub ? (lines.length > 1 ? 22 : 30) : (height / 2 - (lines.length - 1) * 7);
    return '<g class="diagram-node ' + (active ? 'active' : '') + (done ? ' done' : '') + '" transform="translate(' + x + ',' + y + ')" role="button" tabindex="0" data-node="' + Atlas.escape(id) + '" ' + (route ? 'data-route="' + route + '"' : '') + ' aria-label="' + Atlas.escape(label) + '" style="--node-color:var(--' + color + ')"><title>' + Atlas.escape(sub || label) + '</title><rect width="' + width + '" height="' + height + '"/><rect class="node-accent" width="3" height="' + height + '"/><text x="15" y="' + labelTop + '">' + lines.map((line, index) => '<tspan x="15" dy="' + (index ? 16 : 0) + '">' + Atlas.escape(line) + '</tspan>').join('') + '</text>' + (sub ? '<text class="node-sub" x="15" y="' + (height - 14) + '">' + Atlas.escape(sub) + '</text>' : '') + (badge ? '<text class="node-badge" x="' + (width - 12) + '" y="16" text-anchor="end">' + Atlas.escape(badge) + '</text>' : '') + '</g>';
  };
  Atlas.edge = (path, active = false, label = '', labelX = 0, labelY = 0) => '<path class="flow-edge ' + (active ? 'active' : '') + '" d="' + path + '" marker-end="url(#arrow)"/>' + (label ? '<text class="edge-label" x="' + labelX + '" y="' + labelY + '">' + Atlas.escape(label) + '</text>' : '');
  Atlas.linearDiagram = (stages, frame, color = 'data') => {
    const columns = Math.min(4, stages.length);
    const rows = Math.ceil(stages.length / columns);
    const width = 900;
    const height = rows * 135 + 65;
    const positions = stages.map((_, index) => {
      const row = Math.floor(index / columns);
      const column = row % 2 ? columns - 1 - index % columns : index % columns;
      return { x: 40 + column * 218, y: 44 + row * 135 };
    });
    const links = positions.slice(1).map((position, index) => {
      const previous = positions[index];
      const path = position.y === previous.y ? (position.x > previous.x ? 'M' + (previous.x + 172) + ',' + (previous.y + 36) + ' H' + (position.x - 6) : 'M' + previous.x + ',' + (previous.y + 36) + ' H' + (position.x + 178)) : 'M' + (previous.x + 86) + ',' + (previous.y + 72) + ' V' + (position.y - 6);
      return Atlas.edge(path, index < frame);
    }).join('');
    const nodes = stages.map((stage, index) => Atlas.node({ id: String(index), label: typeof stage === 'string' ? stage : stage.label, sub: typeof stage === 'string' ? 'STAGE ' + String(index + 1).padStart(2, '0') : stage.sub || '', ...positions[index], color: typeof stage === 'string' ? color : stage.color || color, active: index === frame, done: index < frame, route: typeof stage === 'string' ? '' : stage.route || '' })).join('');
    return Atlas.svg(links + nodes, width, height, 'Step-by-step data flow');
  };
  Atlas.createPlayer = ({ length = 8, onFrame, loop = false, interval = 1100 }) => {
    let timer = null;
    const player = {
      frame: 0, length, running: false, speed: 1,
      draw() {
        onFrame(player.frame);
        const root = document.getElementById('playback');
        if (root) {
          const position = root.querySelector('[data-position]');
          if (position) position.textContent = String(player.frame + 1).padStart(2, '0') + ' / ' + String(player.length).padStart(2, '0');
          const play = root.querySelector('[data-action="play"]');
          if (play) { play.innerHTML = Atlas.icon(player.running ? 'pause' : 'play'); play.title = player.running ? 'Pause animation' : 'Play animation'; play.setAttribute('aria-label', play.title); }
          const previous = root.querySelector('[data-action="back"]');
          const next = root.querySelector('[data-action="next"]');
          if (previous) previous.disabled = player.frame === 0;
          if (next) next.disabled = player.frame === player.length - 1;
        }
        const simulation = document.getElementById('simulation');
        simulation?.classList.toggle('running', player.running);
        document.getElementById('animation-state')?.replaceChildren(document.createTextNode(player.running ? 'RUNNING' : 'PAUSED'));
        Atlas.icons();
      },
      seek(frame) { player.pause(); player.frame = Math.max(0, Math.min(player.length - 1, frame)); player.draw(); },
      play() {
        if (player.running) { player.pause(); player.draw(); return; }
        if (player.frame === player.length - 1) player.frame = 0;
        player.running = true;
        player.draw();
        timer = setInterval(() => {
          if (player.frame < player.length - 1) player.frame++;
          else if (loop) player.frame = 0;
          else { player.pause(); }
          player.draw();
        }, interval / player.speed);
      },
      pause() { if (timer !== null) clearInterval(timer); timer = null; player.running = false; },
      setSpeed(speed) { const wasRunning = player.running; player.pause(); player.speed = speed; if (wasRunning) player.play(); },
      reset() { player.seek(0); },
      dispose() { player.pause(); }
    };
    Atlas.activePlayer?.dispose();
    Atlas.activePlayer = player;
    return player;
  };
  Atlas.attachZoom = root => {
    if (!window.d3) return;
    root.querySelectorAll('svg.zoomable').forEach(svg => {
      const layer = svg.querySelector('.zoom-layer');
      const viewbox = svg.viewBox.baseVal;
      const behavior = window.d3.zoom().extent([[0, 0], [viewbox.width, viewbox.height]]).scaleExtent([0.35, 3]).filter(event => !event.target.closest('.diagram-node') && (!event.ctrlKey || event.type === 'wheel') && !event.button).on('zoom', event => { layer.setAttribute('transform', event.transform.toString()); });
      window.d3.select(svg).call(behavior).on('dblclick.zoom', null);
      svg.atlasZoom = behavior;
    });
  };
  Atlas.zoom = direction => {
    const svg = document.querySelector('#simulation svg.zoomable');
    if (!svg?.atlasZoom || !window.d3) return;
    if (direction === 0) window.d3.select(svg).call(svg.atlasZoom.transform, window.d3.zoomIdentity);
    else window.d3.select(svg).call(svg.atlasZoom.scaleBy, direction > 0 ? 1.25 : 0.8);
  };
  Atlas.bindInputs = root => {
    root.querySelectorAll('input[type="range"]').forEach(input => input.addEventListener('input', () => {
      const output = root.querySelector('#' + input.id + '-value');
      if (output) output.value = input.value + (input.dataset.suffix || '');
    }));
  };
  Atlas.simulations = {};
  document.addEventListener('visibilitychange', () => { if (document.hidden) Atlas.activePlayer?.pause(); });
})();