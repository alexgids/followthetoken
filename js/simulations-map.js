(function () {
  'use strict';
  const Atlas = window.AIAtlas;
  const escape = Atlas.escape;
  Atlas.mapPositions = {
    ai: [550, 35], ml: [190, 135], deep: [550, 135], generative: [960, 135], rules: [30, 235], neural: [550, 235], foundation: [960, 235],
    optimization: [30, 335], tokens: [215, 335], embeddings: [215, 235], transformer: [550, 335], llm: [960, 335],
    training: [35, 490], finetuning: [220, 490], rl: [35, 590], reasoning: [220, 590],
    attention: [455, 490], multihead: [640, 490], ffn: [455, 590], residual: [640, 590], position: [455, 690], forward: [640, 690], sampling: [455, 790],
    inference: [875, 490], gpus: [1060, 490], kv: [875, 590], quantization: [1060, 590], moe: [875, 690], context: [1060, 690],
    rag: [35, 790], knowledge: [220, 790], agents: [35, 890], tools: [220, 890], mcp: [35, 990], memory: [220, 990],
    evaluation: [455, 945], reward: [640, 945], hallucination: [825, 945], safety: [1010, 945], production: [640, 1045], mental: [960, 1045], map: [30, 1130]
  };
  const virtual = {
    ml: { title: 'Machine learning', route: 'ai', color: 'data', sub: 'LEARN FROM EXAMPLES' },
    deep: { title: 'Deep learning', route: 'neural', color: 'data', sub: 'MULTILAYER NETWORKS' },
    generative: { title: 'Generative AI', route: 'ai', color: 'decision', sub: 'CONTENT GENERATION' },
    rules: { title: 'Rule-based systems', route: 'ai', color: 'decision', sub: 'HAND-WRITTEN LOGIC' },
    foundation: { title: 'Foundation models', route: 'training', color: 'model', sub: 'BROAD PRETRAINING' },
    llm: { title: 'Language models', route: 'forward', color: 'model', sub: 'LANGUAGE PREDICTION' }
  };
  Atlas.mapEdges = [
    ['ai', 'ml', false], ['ai', 'rules', false], ['ml', 'deep', false], ['deep', 'neural', false], ['neural', 'transformer', false],
    ['ai', 'generative', true], ['generative', 'foundation', true], ['foundation', 'llm', true], ['transformer', 'llm', true],
    ['transformer', 'attention', false], ['transformer', 'ffn', false], ['attention', 'multihead', false], ['transformer', 'residual', false], ['transformer', 'position', false], ['llm', 'forward', false], ['forward', 'sampling', false],
    ['llm', 'training', true], ['llm', 'inference', false], ['training', 'finetuning', false], ['finetuning', 'rl', true], ['optimization', 'training', true], ['finetuning', 'reasoning', true],
    ['inference', 'gpus', false], ['inference', 'kv', false], ['gpus', 'quantization', false], ['ffn', 'moe', true], ['inference', 'context', false], ['attention', 'kv', true],
    ['tokens', 'embeddings', false], ['embeddings', 'rag', true], ['rag', 'knowledge', true], ['agents', 'rag', false], ['agents', 'tools', false], ['tools', 'mcp', false], ['agents', 'memory', false],
    ['inference', 'agents', true], ['agents', 'production', true], ['production', 'evaluation', false], ['production', 'safety', false], ['evaluation', 'hallucination', false], ['rl', 'reward', true], ['production', 'mental', true]
  ];
  Atlas.simulations.map = (root, topic) => {
    const journeys = {
      overview: [['ai', 'The broad field'], ['ml', 'Learn behavior from data'], ['deep', 'Use layered neural networks'], ['neural', 'A parameterized learned function'], ['transformer', 'Attention + FFN architecture'], ['llm', 'Predict language tokens'], ['training', 'Learn the parameters'], ['inference', 'Use fixed parameters'], ['rag', 'Add retrieved evidence'], ['agents', 'Act through tools in a loop'], ['production', 'Operate reliably']],
      drill: [['transformer', 'Repeated blocks'], ['attention', 'Token communication'], ['multihead', 'Several Q/K/V projections'], ['attention', 'Q times K transpose: matrix multiplication'], ['gpus', 'Tensor cores execute parallel matrix math'], ['kv', 'Keys/values live in GPU memory'], ['inference', 'Distributed serving coordinates GPUs']],
      rag: [['ai', 'AI'], ['generative', 'Generative AI'], ['llm', 'LLM applications'], ['rag', 'Retrieval-augmented generation'], ['embeddings', 'Query/document embeddings'], ['rag', 'Vector or hybrid search'], ['context', 'Evidence enters context'], ['llm', 'Generate a grounded answer']],
      rlhf: [['ai', 'AI'], ['ml', 'Machine learning'], ['deep', 'Deep learning'], ['foundation', 'Foundation model'], ['training', 'LLM training'], ['finetuning', 'Alignment / post-training'], ['rl', 'RLHF uses reward-driven optimization']]
    };
    const mental = topic.id === 'mental';
    const controls = (mental ? Atlas.select('map-journey', 'Guided journey', [['overview', 'Zoom out: AI to production'], ['drill', 'Drill down: transformer to GPUs'], ['rag', 'Where does RAG fit?'], ['rlhf', 'Where does RLHF fit?']], 'overview') : '') + Atlas.select('map-focus', 'Explore a layer', [['all', 'The entire AI ecosystem'], ['foundations', 'Foundations'], ['learning', 'Training & reasoning'], ['transformers', 'Transformer computation'], ['systems', 'Serving & GPUs'], ['applications', 'Retrieval & agents'], ['production', 'Production & reliability']], 'all') + '<label class="checkbox-field"><input type="checkbox" id="map-cross-links" checked>Cross-layer connections</label><span class="map-count">36 connected concepts</span>';
    const panels = Atlas.layout(root, controls);
    root.querySelector('.simulation-grid').classList.add('map-grid');
    let tour = mental ? journeys.overview : ['ai', 'neural', 'tokens', 'transformer', 'training', 'inference', 'agents', 'production', 'mental'].map(id => [id, '']);
    const zones = [
      { id: 'learning', x: 18, y: 440, width: 384, height: 230, label: 'LEARNING & REASONING', color: 'compute' },
      { id: 'transformers', x: 438, y: 440, width: 384, height: 425, label: 'INSIDE THE TRANSFORMER', color: 'model' },
      { id: 'systems', x: 858, y: 440, width: 384, height: 330, label: 'MODELS AT SCALE', color: 'storage' },
      { id: 'applications', x: 18, y: 740, width: 384, height: 340, label: 'RETRIEVAL & ACTION', color: 'decision' },
      { id: 'production', x: 438, y: 900, width: 804, height: 220, label: 'RELIABILITY & OPERATIONS', color: 'error' }
    ];
    function showTopic(id, step = '', frame = -1) {
      const current = Atlas.byId[id] || Atlas.byId[virtual[id]?.route || 'ai'];
      const trail = step ? tour.slice(0, frame + 1).map(item => virtual[item[0]]?.title || Atlas.byId[item[0]].title).join(' / ') : 'AI / ' + current.path.filter(item => item !== 'ai').map(item => Atlas.byId[item].title).concat(current.title).join(' / ');
      panels.inspector.innerHTML = '<div class="map-current"><span class="tiny-label">' + (step ? 'JOURNEY STEP ' + (frame + 1) + ' / ' + tour.length : 'WHERE IT FITS') + '</span><h3>' + escape(step || virtual[id]?.title || current.title) + '</h3><div class="map-breadcrumb">' + escape(trail) + '</div></div><p class="map-insight">' + escape(current.intuition) + '</p><a class="inspect-link" href="#' + current.id + '">Explore this concept ' + Atlas.icon('arrow-up-right') + '</a>';
      Atlas.icons();
    }
    const player = Atlas.createPlayer({ length: tour.length, interval: 1300, onFrame(frame) {
      const active = tour[frame][0];
      const visited = new Set(tour.slice(0, frame + 1).map(item => item[0]));
      let drawing = '<text class="diagram-note" x="30" y="31">FIELD / METHODS / ARCHITECTURES / APPLICATIONS: RELATED, NOT ONE RIGID TAXONOMY</text>';
      drawing += zones.map(zone => '<rect class="map-zone" x="' + zone.x + '" y="' + zone.y + '" width="' + zone.width + '" height="' + zone.height + '" rx="5" style="--zone-color:var(--' + zone.color + ')"/><text class="map-zone-label" x="' + (zone.x + 17) + '" y="' + (zone.y + 27) + '" fill="var(--' + zone.color + ')">' + zone.label + '</text>').join('');
      const cross = root.querySelector('#map-cross-links').checked;
      drawing += Atlas.mapEdges.filter(edge => !edge[2] || cross).map(([from, to, dashed]) => {
        const start = Atlas.mapPositions[from];
        const end = Atlas.mapPositions[to];
        const horizontal = start[1] === end[1];
        const startX = start[0] + (horizontal ? end[0] > start[0] ? 164 : 0 : 82);
        const startY = start[1] + (horizontal ? 34 : 68);
        const endX = end[0] + (horizontal ? end[0] > start[0] ? -6 : 170 : 82);
        const endY = end[1] + (horizontal ? 34 : -6);
        const path = horizontal ? 'M' + startX + ',' + startY + ' H' + endX : 'M' + startX + ',' + startY + ' C' + startX + ',' + (startY + 32) + ' ' + endX + ',' + (endY - 32) + ' ' + endX + ',' + endY;
        return '<path class="map-edge ' + (from === active || to === active || (mental && visited.has(from) && visited.has(to)) ? 'focused' : '') + '" d="' + path + '" ' + (dashed ? 'stroke-dasharray="4 5"' : '') + '/>';
      }).join('');
      drawing += Object.entries(Atlas.mapPositions).map(([id, [x, y]]) => {
        const current = Atlas.byId[id];
        const alternate = virtual[id];
        return Atlas.node({ id, label: alternate?.title || current.title, sub: alternate?.sub || (id === 'map' ? 'BACK TO THE FULL MAP' : String(current.number).padStart(2, '0') + ' / ' + Atlas.groups.find(group => group.id === current.group).title), x, y, width: 164, height: 68, color: alternate?.color || current.color, active: id === active, done: mental && visited.has(id) && id !== active, route: alternate?.route || id });
      }).join('');
      drawing += '<text class="diagram-note" x="250" y="1172">SOLID: STRUCTURAL / FUNCTIONAL LINK. DASHED: CROSS-LAYER OR OVERLAPPING RELATION.</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 1265, 1220, 'The complete connected AI ecosystem, with every concept linking to its visualization'));
      showTopic(active, tour[frame][1], frame);
      root.dataset.mapNodes = Object.keys(Atlas.mapPositions).length;
      root.dataset.journeyStep = active;
    } });
    root.querySelector('#map-journey')?.addEventListener('change', event => { tour = journeys[event.target.value]; player.length = tour.length; player.seek(0); });
    root.addEventListener('mouseleave', () => player.draw());
    const regions = { foundations: { x: 10, y: 105, width: 790, height: 340 }, ...Object.fromEntries(zones.map(zone => [zone.id, zone])) };
    root.querySelector('#map-focus').addEventListener('change', event => {
      const region = regions[event.target.value];
      const svg = panels.visual.querySelector('svg');
      if (!svg?.atlasZoom) return;
      if (!region) Atlas.zoom(0);
      else {
        const scale = Math.min(1265 / (region.width + 120), 1220 / (region.height + 120), 2.6);
        const x = (1265 - region.width * scale) / 2 - region.x * scale;
        const y = (1220 - region.height * scale) / 2 - region.y * scale;
        window.d3.select(svg).call(svg.atlasZoom.transform, window.d3.zoomIdentity.translate(x, y).scale(scale));
      }
    });
    root.querySelector('#map-cross-links').addEventListener('change', () => player.draw());
    root.addEventListener('mouseover', event => { const node = event.target.closest('[data-node]'); if (node) showTopic(node.dataset.node); });
    root.addEventListener('focusin', event => { const node = event.target.closest('[data-node]'); if (node) showTopic(node.dataset.node); });
    player.draw();
    return player;
  };
})();