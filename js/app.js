(function () {
  'use strict';
  const Atlas = window.AIAtlas;
  const statuses = [['not-started', 'Not started'], ['learning', 'Learning'], ['understand', 'Understand'], ['mastered', 'Mastered']];
  const escape = Atlas.escape;
  function progressSelect(id, compact = false) {
    return '<select class="progress-select ' + (compact ? 'compact' : '') + '" data-progress="' + id + '" aria-label="Learning status for ' + escape(Atlas.byId[id].title) + '">' + statuses.map(([value, label]) => '<option value="' + value + '" ' + ((Atlas.state.progress[id] || 'not-started') === value ? 'selected' : '') + '>' + label + '</option>').join('') + '</select>';
  }
  function updateProgress() {
    const count = Atlas.concepts.filter(topic => ['understand', 'mastered'].includes(Atlas.state.progress[topic.id])).length;
    document.getElementById('progress-label').textContent = count + ' / 36';
    document.getElementById('progress-fill').style.width = count / 36 * 100 + '%';
  }
  function sidebar() {
    const query = document.getElementById('nav-search').value.trim().toLowerCase();
    const matches = topic => !query || (topic.title + ' ' + topic.subtitle + ' ' + Atlas.glossary.filter(term => term.topic === topic.id).map(term => term.term).join(' ')).toLowerCase().includes(query);
    const link = (id, title, icon, index) => '<a class="nav-link ' + (Atlas.state.route === id ? 'active' : '') + '" ' + (Atlas.state.route === id ? 'aria-current="page"' : '') + ' href="#' + id + '">' + (icon ? Atlas.icon(icon) : '<span class="nav-index">' + String(index).padStart(2, '0') + '</span>') + '<span>' + escape(title) + '</span>' + (Atlas.state.progress[id] === 'mastered' ? Atlas.icon('check', 'nav-complete') : '') + '</a>';
    let html = '<div class="nav-group-label">YOUR EXPLORATION</div>';
    if (!query) html += link('home', 'Overview', 'compass') + link('forward', 'Follow the data', 'route');
    Atlas.groups.forEach(group => {
      const topics = Atlas.concepts.filter(topic => topic.group === group.id && matches(topic));
      if (!topics.length) return;
      html += '<div class="nav-group-label"><span class="group-dot" style="background:var(--' + group.color + ')"></span>' + group.title + '</div>';
      html += topics.map(topic => link(topic.id, topic.title, null, topic.number)).join('');
    });
    if (query && !Atlas.concepts.some(matches)) html += '<p class="nav-empty">No matching concepts.</p>';
    document.getElementById('navigation').innerHTML = html;
    updateProgress();
    Atlas.icons();
  }
  function breadcrumbs(topic, route) {
    const labels = { home: 'Overview', glossary: 'Glossary', learning: 'Learning path', comparison: 'Training vs inference' };
    const path = topic ? [...topic.path, topic.id] : [];
    document.getElementById('breadcrumbs').innerHTML = '<a href="#home">Follow the Token</a>' + (path.length ? path.map((id, index) => '<span class="breadcrumb-separator">/</span>' + (index === path.length - 1 ? '<span aria-current="page">' + escape(Atlas.byId[id].title) + '</span>' : '<a href="#' + id + '">' + escape(Atlas.byId[id].title) + '</a>')).join('') : '<span>/</span><span aria-current="page">' + escape(labels[route] || 'Not found') + '</span>');
  }
  function toolbar(topic) {
    return '<div class="viz-toolbar"><div class="viz-title"><span class="group-dot" style="background:var(--' + topic.color + ')"></span><span>' + (topic.id === 'forward' ? 'FOLLOW THE DATA' : 'INTERACTIVE MODEL') + '</span></div><div class="viz-tools"><span class="animation-state" id="animation-state">PAUSED</span>' + Atlas.button('Zoom out', 'zoom-out', 'data-zoom="-1"') + Atlas.button('Zoom in', 'zoom-in', 'data-zoom="1"') + Atlas.button('Fit diagram', 'maximize', 'data-zoom="0"') + '</div></div>';
  }
  function playback() {
    return '<div class="transport" id="playback">' + Atlas.button('Step backward', 'skip-back', 'data-action="back"') + '<button class="icon-button primary-play" data-action="play" title="Play animation" aria-label="Play animation">' + Atlas.icon('play') + '</button>' + Atlas.button('Step forward', 'skip-forward', 'data-action="next"') + Atlas.button('Reset simulation', 'rotate-ccw', 'data-action="reset"') + '<span class="transport-position" data-position>01 / 12</span><div class="transport-right"><label for="animation-speed">Speed</label><input id="animation-speed" type="range" min="0.5" max="3" step="0.5" value="1"><output id="speed-label">1x</output></div></div>';
  }
  function where(topic) {
    return '<section class="where-section"><div class="section-label">' + Atlas.icon('map-pin') + '<h3>Where does this live?</h3></div><div class="where-grid">' + ['Software', 'Mathematics', 'Hardware', 'Memory', 'System'].map((title, index) => '<div><span class="tiny-label">' + title.toUpperCase() + '</span><p>' + escape(topic.where[index]) + '</p></div>').join('') + '</div></section>';
  }
  function connections(topic) {
    return '<section class="connections-section"><div class="section-label">' + Atlas.icon('git-branch') + '<h3>Connects to</h3></div><div class="connections">' + topic.connections.map(id => '<a class="connection-link" href="#' + id + '"><span>' + escape(Atlas.byId[id].title) + '</span>' + Atlas.icon('arrow-up-right') + '</a>').join('') + '</div></section>';
  }
  function explanation(topic) {
    const level = ['intuition', 'technical', 'systems'].includes(Atlas.state.level) ? Atlas.state.level : 'intuition';
    return '<section class="explanation-section"><div class="explanation-tabs" role="tablist" aria-label="Explanation depth">' + [['intuition', "Explain like I'm 10"], ['technical', 'Technical explanation'], ['systems', 'System architecture']].map(([id, label]) => '<button class="explanation-tab ' + (id === level ? 'active' : '') + '" role="tab" aria-selected="' + (id === level) + '" aria-controls="explanation-text" data-level="' + id + '">' + label + '</button>').join('') + '<label class="math-option"><input id="math-toggle" type="checkbox" ' + (Atlas.state.mathematics ? 'checked' : '') + '>' + Atlas.icon('sigma') + '<span>Mathematics</span></label></div><div class="explanation-grid"><div><p id="explanation-text" role="tabpanel">' + escape(topic[level]) + '</p><div id="equation-container" ' + (!Atlas.state.mathematics ? 'hidden' : '') + '>' + Atlas.equation(topic.formula) + '</div></div><div class="example-block"><span class="tiny-label">CONCRETE EXAMPLE</span><p>' + escape(topic.example) + '</p></div></div></section>';
  }
  function contrastStrip() {
    return '<a href="#comparison" class="contrast-strip"><div>' + Atlas.icon('chart-no-axes-combined') + '<span><strong>Training</strong><small>Data changes the parameters.</small></span></div><span class="contrast-divider">&#8800;</span><div>' + Atlas.icon('workflow') + '<span><strong>Inference</strong><small>Parameters transform new data.</small></span></div>' + Atlas.icon('arrow-up-right') + '</a>';
  }
  function stack() {
    const clusters = [
      ['FOUNDATIONS', 'data', ['neural', 'optimization', 'tokens', 'embeddings']],
      ['TRANSFORMERS', 'model', ['attention', 'ffn', 'position', 'transformer']],
      ['LANGUAGE MODELS', 'compute', ['training', 'finetuning', 'rl', 'reasoning']],
      ['MODELS AT SCALE', 'storage', ['gpus', 'inference', 'kv', 'quantization', 'moe']],
      ['AI APPLICATIONS', 'decision', ['rag', 'agents', 'tools', 'mcp', 'memory']],
      ['PRODUCTION', 'error', ['evaluation', 'hallucination', 'safety', 'production']]
    ];
    return '<section class="stack-section"><div class="section-heading"><h2>Explore the AI stack</h2><a class="text-link" href="#map">View the connected map ' + Atlas.icon('arrow-up-right') + '</a></div><div class="stack-grid">' + clusters.map(([title, color, ids]) => '<div class="stack-group" style="--group-color:var(--' + color + ')"><h3>' + title + '</h3>' + ids.map(id => '<a href="#' + id + '">' + escape(Atlas.byId[id].title) + Atlas.icon('arrow-up-right') + '</a>').join('') + '</div>').join('') + '</div></section>';
  }
  function renderTopic(topic, home = false) {
    const heading = home ? 'How Does AI Actually Work?' : topic.title;
    const group = Atlas.groups.find(item => item.id === topic.group);
    const main = document.getElementById('main');
    main.innerHTML = '<div class="page-heading"><div><p class="eyebrow">' + (home ? 'A FIELD GUIDE TO MACHINE INTELLIGENCE' : group.title + ' / ' + String(topic.number).padStart(2, '0')) + '</p><h1>' + escape(heading) + '</h1><p class="lede">' + escape(home ? 'From human language to a generated response. Follow the signal through one connected system.' : topic.subtitle) + '</p></div>' + (home ? '<a class="primary-button" href="#map">Explore the AI map ' + Atlas.icon('arrow-up-right') + '</a>' : '<div class="heading-status"><span class="tiny-label">YOUR UNDERSTANDING</span>' + progressSelect(topic.id) + '</div>') + '</div>' + (home ? '<div class="view-tabs"><button class="view-tab active" data-home-tab="forward">' + Atlas.icon('route') + 'Follow the data</button><button class="view-tab" data-home-tab="map">' + Atlas.icon('network') + 'The AI map</button><button class="view-tab" data-home-tab="comparison">' + Atlas.icon('split') + 'Training vs inference</button></div>' : '') + '<section class="visualization" aria-label="' + escape(topic.title) + ' visualization">' + toolbar(topic) + '<div id="simulation"></div>' + playback() + '</section><div class="visual-caption"><span class="representation">Simplified conceptual representation.</span><div class="legend">' + [['data', 'Data'], ['model', 'Model'], ['compute', 'Compute'], ['storage', 'Storage'], ['error', 'Loss'], ['decision', 'Decision']].map(([color, label]) => '<span><span class="group-dot" style="background:var(--' + color + ')"></span>' + label + '</span>').join('') + '</div></div>' + (home ? contrastStrip() + stack() : explanation(topic) + where(topic) + connections(topic) + '<div class="topic-pagination">' + (topic.number > 0 ? '<a href="#' + Atlas.concepts[topic.number - 1].id + '">' + Atlas.icon('arrow-left') + '<span><small>PREVIOUS CONCEPT</small>' + escape(Atlas.concepts[topic.number - 1].title) + '</span></a>' : '<a href="#home">' + Atlas.icon('arrow-left') + '<span>Overview</span></a>') + (topic.number < 35 ? '<a class="next-topic" href="#' + Atlas.concepts[topic.number + 1].id + '"><span><small>NEXT CONCEPT</small>' + escape(Atlas.concepts[topic.number + 1].title) + '</span>' + Atlas.icon('arrow-right') + '</a>' : '<a class="next-topic" href="#learning"><span>Learning path</span>' + Atlas.icon('arrow-right') + '</a>') + '</div>');
    Atlas.mountSimulation(document.getElementById('simulation'), topic);
    Atlas.renderMath(main);
    Atlas.icons();
  }
  function renderLearning() {
    document.getElementById('main').innerHTML = '<div class="page-heading"><div><p class="eyebrow">FROM INTUITION TO SYSTEMS</p><h1>Your learning path</h1><p class="lede">A connected route through the model, its mathematics, and the systems around it.</p></div><a href="#mental" class="primary-button">The complete map ' + Atlas.icon('arrow-up-right') + '</a></div><div class="learning-overview">' + statuses.map(([value, label]) => Atlas.metric(label, Atlas.concepts.filter(topic => (Atlas.state.progress[topic.id] || 'not-started') === value).length, value === 'mastered' ? 'storage' : 'data')).join('') + '</div>' + Atlas.paths.map((path, index) => '<section class="learning-section"><div class="learning-heading"><span class="path-number">0' + (index + 1) + '</span><div><h2>' + path.title + '</h2><p>' + path.subtitle + '</p></div></div><div class="learning-list">' + path.topics.map((id, topicIndex) => '<div class="learning-row"><span class="learning-order">' + String(topicIndex + 1).padStart(2, '0') + '</span><a href="#' + id + '"><strong>' + escape(Atlas.byId[id].title) + '</strong><span>' + escape(Atlas.byId[id].subtitle) + '</span></a>' + progressSelect(id, true) + '<a href="#' + id + '" class="icon-button" aria-label="Explore ' + escape(Atlas.byId[id].title) + '" title="Explore ' + escape(Atlas.byId[id].title) + '">' + Atlas.icon('arrow-up-right') + '</a></div>').join('') + '</div></section>').join('') + '<p class="representation" id="storage-message" role="status">Progress is stored in this browser on this device.</p>';
    Atlas.icons();
  }
  function glossaryResults(query = '') {
    const terms = Atlas.glossary.filter(term => (term.term + ' ' + term.definition).toLowerCase().includes(query.toLowerCase()));
    document.getElementById('glossary-count').textContent = terms.length + ' terms';
    document.getElementById('glossary-results').innerHTML = terms.sort((left, right) => left.term.localeCompare(right.term)).map(term => '<a class="glossary-row" href="#' + term.topic + '"><strong>' + escape(term.term) + '</strong><span>' + escape(term.definition) + '</span>' + Atlas.icon('arrow-up-right') + '</a>').join('') || '<div class="empty-state">No matching terms.</div>';
    Atlas.icons();
  }
  function renderGlossary() {
    document.getElementById('main').innerHTML = '<div class="page-heading"><div><p class="eyebrow">THE LANGUAGE OF THE STACK</p><h1>Glossary</h1><p class="lede">Every term has a place in the connected mental model.</p></div><span class="count-label" id="glossary-count"></span></div><label class="glossary-search">' + Atlas.icon('search') + '<input type="search" id="glossary-search" placeholder="Search terms, definitions, or related concepts" aria-label="Search the glossary"></label><div id="glossary-results" class="glossary-list"></div>';
    glossaryResults();
    document.getElementById('glossary-search').addEventListener('input', event => glossaryResults(event.target.value));
  }
  const comparisonRows = [
    ['Goal', 'Learn or adapt parameters', 'Use trained parameters'],
    ['Input', 'Training examples and target/reward signals', 'A prompt and optional external context'],
    ['Forward pass', 'Yes', 'Yes'],
    ['Training loss', 'Needed for the training objective', 'Not required for ordinary generation'],
    ['Backpropagation', 'Used in gradient-based training', 'Not in ordinary inference'],
    ['Gradients', 'Computed for the update', 'Normally disabled'],
    ['Parameter updates', 'Yes: optimizer or learned adapters', 'No: weights remain fixed'],
    ['Temporary memory', 'Activations, gradients, optimizer states', 'Activations, KV cache, runtime buffers'],
    ['Optimization target', 'Learning quality and training efficiency', 'Latency, throughput, memory, cost'],
    ['Knowledge update', 'Statistical behavior can change', 'RAG changes context, not model weights']
  ];
  function renderComparison() {
    document.getElementById('main').innerHTML = '<div class="page-heading"><div><p class="eyebrow">ONE MODEL. TWO DIFFERENT PROCESSES.</p><h1>Training vs inference</h1><p class="lede">The forward computation is shared. The purpose, memory, and parameter lifecycle are different.</p></div></div><div class="comparison-diagrams"><section><div class="comparison-heading"><span class="group-dot" style="background:var(--compute)"></span><h2>Training</h2><span class="tiny-label">WEIGHTS CHANGE</span></div><div class="comparison-flow">' + ['Data + targets', 'Forward pass', 'Loss', 'Backpropagation', 'Optimizer', 'Updated weights'].map(stage => '<span>' + stage + '</span>').join(Atlas.icon('arrow-right')) + '</div></section><section><div class="comparison-heading"><span class="group-dot" style="background:var(--data)"></span><h2>Inference</h2><span class="tiny-label">WEIGHTS STAY FIXED</span></div><div class="comparison-flow">' + ['Prompt + context', 'Forward pass', 'Logits', 'Token selection', 'KV cache', 'Repeat'].map(stage => '<span>' + stage + '</span>').join(Atlas.icon('arrow-right')) + '</div></section></div><div class="table-scroll"><table class="comparison-table"><thead><tr><th>COMPONENT</th><th>TRAINING</th><th>INFERENCE</th></tr></thead><tbody>' + comparisonRows.map(row => '<tr>' + row.map((cell, index) => '<' + (index ? 'td' : 'th') + '>' + cell + '</' + (index ? 'td' : 'th') + '>').join('') + '</tr>').join('') + '</tbody></table></div>' + Atlas.notice('Ordinary inference, not every possible algorithm', 'Test-time adaptation and other specialized methods can update parameters at serving time. That is different from the standard generation loop shown here.', 'compute') + '<div class="connections"><a class="connection-link" href="#training">Training pipeline ' + Atlas.icon('arrow-up-right') + '</a><a class="connection-link" href="#forward">Follow the data ' + Atlas.icon('arrow-up-right') + '</a><a class="connection-link" href="#inference">Production inference ' + Atlas.icon('arrow-up-right') + '</a></div>';
    Atlas.icons();
  }
  function render(routeOverride) {
    Atlas.activePlayer?.dispose();
    Atlas.state.route = typeof routeOverride === 'string' ? routeOverride : location.hash.slice(1) || 'home';
    const route = Atlas.state.route;
    const topic = Atlas.byId[route];
    breadcrumbs(topic, route);
    sidebar();
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
    if (route === 'home') renderTopic(Atlas.byId.forward, true);
    else if (topic) renderTopic(topic);
    else if (route === 'glossary') renderGlossary();
    else if (route === 'learning') renderLearning();
    else if (route === 'comparison') renderComparison();
    else document.getElementById('main').innerHTML = '<div class="empty-state"><h1>That concept is not on the map.</h1><a href="#map" class="primary-button">Return to the AI map</a></div>';
    document.title = route === 'home' ? 'Follow the Token: How AI Actually Works' : (topic?.title || (route === 'learning' ? 'Learning path' : route === 'glossary' ? 'Glossary' : route === 'comparison' ? 'Training vs inference' : 'Not found')) + ' | Follow the Token';
    Atlas.icons();
    window.scrollTo(0, 0);
  }
  document.getElementById('theme-toggle').addEventListener('click', () => {
    Atlas.state.theme = Atlas.state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = Atlas.state.theme;
    Atlas.write('theme', Atlas.state.theme);
  });
  document.getElementById('menu-toggle').addEventListener('click', event => {
    const open = document.getElementById('sidebar').classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('nav-search').addEventListener('input', sidebar);
  document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); document.getElementById('main').focus(); });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button && Atlas.activePlayer) {
      const player = Atlas.activePlayer;
      if (button.dataset.action === 'play') player.play();
      if (button.dataset.action === 'back') player.seek(player.frame - 1);
      if (button.dataset.action === 'next') player.seek(player.frame + 1);
      if (button.dataset.action === 'reset') { player.reset(); player.draw(); }
    }
    const zoom = event.target.closest('[data-zoom]');
    if (zoom) Atlas.zoom(Number(zoom.dataset.zoom));
    const level = event.target.closest('[data-level]');
    if (level) {
      Atlas.state.level = level.dataset.level;
      Atlas.write('level', Atlas.state.level);
      const topic = Atlas.byId[Atlas.state.route];
      document.getElementById('explanation-text').textContent = topic[Atlas.state.level];
      document.querySelectorAll('[data-level]').forEach(tab => { const selected = tab.dataset.level === Atlas.state.level; tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', String(selected)); });
    }
    const homeTab = event.target.closest('[data-home-tab]');
    if (homeTab) Atlas.navigate(homeTab.dataset.homeTab === 'forward' ? 'home' : homeTab.dataset.homeTab);
    const route = event.target.closest('[data-route]');
    if (route) Atlas.navigate(route.dataset.route);
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-progress]')) {
      Atlas.state.progress[event.target.dataset.progress] = event.target.value;
      const saved = Atlas.write('progress', Atlas.state.progress);
      if (!saved && document.getElementById('storage-message')) document.getElementById('storage-message').textContent = 'Browser storage is unavailable. Progress will last only for this session.';
      if (Atlas.state.route === 'learning') renderLearning();
      sidebar();
    }
    if (event.target.id === 'math-toggle') {
      Atlas.state.mathematics = event.target.checked;
      Atlas.write('mathematics', Atlas.state.mathematics);
      document.getElementById('equation-container').hidden = !event.target.checked;
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'animation-speed') {
      Atlas.activePlayer?.setSpeed(Number(event.target.value));
      document.getElementById('speed-label').value = event.target.value + 'x';
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      const node = event.target.closest('g[role="button"]');
      if (node) { event.preventDefault(); node.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    }
    if (event.key === 'Escape') { document.getElementById('sidebar').classList.remove('open'); document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false'); }
  });
  window.addEventListener('hashchange', () => render());
  Atlas.render = render;
  render();
})();