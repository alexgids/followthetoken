(function () {
  'use strict';
  const Atlas = window.AIAtlas;
  const math = Atlas.math;
  const escape = Atlas.escape;
  Atlas.corpus = [
    { id: 'S1', title: 'What the KV cache keeps', category: 'systems', text: 'KV cache stores attention keys and values for previous token positions. Reusing these projections saves repeated prefix work during inference, but attention still reads the available history. Cache memory grows with context length, layer count, KV head count, and active sequences.' },
    { id: 'S2', title: 'Training is not inference', category: 'foundations', text: 'Training updates learned parameters using loss, gradients, backpropagation, and an optimizer. Ordinary inference computes with fixed weights. Activations and context change during inference, but the learned parameters do not. Retrieval changes the prompt, not the model weights.' },
    { id: 'S3', title: 'Retrieve before you generate', category: 'applications', text: 'RAG retrieves relevant document chunks and supplies their text as context. A vector search compares compatible query and document embeddings. Hybrid search combines semantic and lexical signals. Reranking can improve the order of retrieved candidates. Citations must support the answer claims.' },
    { id: 'S4', title: 'A standard integration boundary', category: 'applications', text: 'MCP standardizes communication between host-managed clients and servers exposing tools, resources, and prompts. The host and server enforce permissions. MCP does not train a model or automatically authorize tool execution.' },
    { id: 'S5', title: 'Many GPUs, different partitions', category: 'systems', text: 'Tensor parallelism shards tensor operations within layers. Pipeline parallelism splits layer groups across GPUs. Data parallelism replicates the whole model for separate batches or requests. Expert parallelism distributes MoE experts. HBM capacity and interconnect communication both matter.' },
    { id: 'S6', title: 'From language to numbers', category: 'foundations', text: 'Tokens are vocabulary pieces, not always words. A tokenizer maps text to token IDs. An embedding layer uses each ID to look up a learned vector. Hidden states become contextual after transformer computations; they are not the same as initial token embeddings.' },
    { id: 'S7', title: 'The runtime performs the action', category: 'applications', text: 'An agent proposes a tool call with structured arguments. The runtime validates and authorizes those arguments, executes a function, and returns an observation. Agent state, bounded planning loops, memory, and independent evaluation determine system capability.' },
    { id: 'S8', title: 'Aster mission: fictional source fixture', category: 'production', text: 'The fictional Aster mission launched in 2040. This record is an educational fixture, not a fact about a real space mission. Its stated year is used to test whether a sample answer is grounded in supplied evidence.' },
    { id: 'S9', title: 'Smaller weights are not free speed', category: 'systems', text: 'Quantization reduces ideal weight bytes with lower precision. INT4 packed weights use about half a byte before scales and metadata. Quality and throughput depend on the model, kernels, hardware, and calibration. KV cache and runtime buffers still consume additional memory.' }
  ];
  const features = [
    ['cache', 'cached', 'kv', 'keys', 'values', 'prefix'], ['train', 'training', 'gradients', 'loss', 'backpropagation', 'optimizer'],
    ['gpu', 'gpus', 'hbm', 'tensor', 'parallelism', 'parallel', 'shards'], ['rag', 'retrieve', 'retrieval', 'retrieved', 'documents', 'document', 'chunks'],
    ['mcp', 'protocol', 'clients', 'servers', 'resources', 'prompts'], ['agent', 'agents', 'tool', 'tools', 'function', 'runtime', 'execute', 'execution'],
    ['token', 'tokens', 'tokenizer', 'vocabulary', 'ids'], ['embedding', 'embeddings', 'vectors', 'vector', 'semantic', 'similarity'],
    ['context', 'memory', 'history', 'sequences'], ['weights', 'parameters', 'model', 'precision', 'quantization', 'int4'],
    ['aster', 'mission', '2040', 'launch', 'launched'], ['truth', 'citations', 'evidence', 'grounded', 'answer', 'evaluation', 'claims']
  ];
  const words = text => text.toLowerCase().match(/[a-z0-9]+/g) || [];
  Atlas.toyEmbed = text => { const terms = words(text); return features.map(group => terms.filter(term => group.includes(term)).length); };
  Atlas.chunkCorpus = (size = 40) => Atlas.corpus.flatMap(document => {
    const terms = document.text.split(/\s+/);
    const chunks = [];
    for (let index = 0; index < terms.length; index += size) chunks.push({ ...document, docId: document.id, id: document.id + '.' + (chunks.length + 1), text: terms.slice(index, index + size).join(' '), chunk: chunks.length + 1 });
    return chunks;
  });
  Atlas.retrieve = (query, { mode = 'hybrid', filter = 'all', topK = 3, rerank = true, chunkWords = 40 } = {}) => {
    const queryWords = [...new Set(words(query))];
    if (!queryWords.length) return [];
    const embedding = Atlas.toyEmbed(query);
    let matches = Atlas.chunkCorpus(chunkWords).filter(document => filter === 'all' || document.category === filter).map(document => {
      const documentWords = new Set(words(document.title + ' ' + document.text));
      const lexical = queryWords.filter(term => documentWords.has(term)).length / queryWords.length;
      const vector = math.cosine(embedding, Atlas.toyEmbed(document.title + ' ' + document.text));
      const score = mode === 'lexical' ? lexical : mode === 'vector' ? vector : vector * 0.65 + lexical * 0.35;
      return { ...document, lexical, vector, score };
    }).filter(document => document.score > 0).sort((left, right) => right.score - left.score).slice(0, Math.max(4, topK * 2));
    if (rerank) matches = matches.map(document => ({ ...document, score: 0.5 * document.score + 0.5 * document.lexical })).sort((left, right) => right.score - left.score);
    return matches.slice(0, topK);
  };
  Atlas.simulations.rag = (root, topic) => {
    const controls = '<label class="input-label forward-prompt" for="rag-query"><span>QUESTION</span><input class="sim-text-input" id="rag-query" maxlength="500" value="How does KV cache save work?"></label>' + Atlas.select('rag-mode', 'Retrieval', [['hybrid', 'Hybrid: vector + lexical'], ['vector', 'Vector similarity'], ['lexical', 'Lexical search']], 'hybrid') + Atlas.select('rag-filter', 'Metadata filter', [['all', 'All categories'], ['systems', 'Systems'], ['applications', 'Applications'], ['foundations', 'Foundations'], ['production', 'Production']], 'all') + Atlas.select('rag-pipeline', 'Pipeline', [['query', 'Query time'], ['ingest', 'Document ingestion']], 'query') + Atlas.slider('rag-chunk', 'Words per toy chunk', 40, 10, 80, 5) + '<label class="checkbox-field"><input type="checkbox" id="rag-rerank" checked>Toy lexical rerank</label>';
    const panels = Atlas.layout(root, controls, '<div class="rag-answer" id="rag-answer"></div>');
    const player = Atlas.createPlayer({ length: 7, onFrame(frame) {
      const query = root.querySelector('#rag-query').value;
      const chunkWords = Number(root.querySelector('#rag-chunk').value);
      const results = Atlas.retrieve(query, { mode: root.querySelector('#rag-mode').value, filter: root.querySelector('#rag-filter').value, rerank: root.querySelector('#rag-rerank').checked, chunkWords });
      const ingestion = root.querySelector('#rag-pipeline').value === 'ingest';
      const stages = ingestion ? ['Documents', 'Chunking', 'Toy embedding model', 'Vector index'] : topic.flow;
      player.length = stages.length;
      player.frame = Math.min(player.frame, stages.length - 1);
      const current = Math.min(frame, stages.length - 1);
      const chunks = Atlas.chunkCorpus(chunkWords);
      const shown = ingestion ? chunks.slice(0, 4) : results;
      panels.visual.innerHTML = Atlas.linearDiagram(stages, current, 'storage') + '<div class="source-list"><div class="source-list-heading"><span class="tiny-label">' + (ingestion ? chunks.length + ' CHUNKS FROM ' + Atlas.corpus.length + ' DOCUMENTS' : 'RETRIEVED EVIDENCE / ' + results.length + ' RESULTS') + '</span><span class="tiny-label">LOCAL FIXTURE CORPUS</span></div>' + shown.map(document => '<details class="source-row"><summary><span class="source-id">' + document.id + '</span><strong>' + escape(document.title) + '</strong><span class="source-score">' + (ingestion ? document.category : Atlas.format(document.score, 3)) + '</span>' + Atlas.icon('chevron-down') + '</summary><p>' + escape(document.text) + '</p><div class="source-metadata">Category: ' + document.category + ' / chunk: ' + document.chunk + ' / real tokenizer count: ' + Atlas.tokenize(document.text).ids.length + '</div></details>').join('') + (!shown.length ? '<div class="empty-state">No matching evidence. The extract should abstain.</div>' : '') + '</div>';
      Atlas.attachZoom(panels.visual);
      const embedding = Atlas.toyEmbed(query);
      panels.inspector.innerHTML = Atlas.dataPanel(stages[current], ingestion ? 'Nine built-in explanatory documents' : escape(query), ingestion ? ['Keep source IDs and metadata.', 'Split into non-overlapping ' + chunkWords + '-word windows.', 'Count twelve transparent keyword feature groups.', 'Store vectors with chunk text and provenance.'][current] : ['Encode the query with the same toy model as documents.', 'Compute the query feature vector.', 'Rank cosine and/or lexical relevance.', 'Apply category filters and optional lexical rerank.', 'Select passages with source IDs.', 'Place evidence in generation context.', 'Extract a cited passage; abstain if no evidence.'][current], ingestion ? chunks.length + ' indexed chunks' : results.map(document => '[' + document.id + ']').join(' ') || 'No relevant passages', 'embeddings') + '<h4>QUERY VECTOR / 12 TOY FEATURES</h4>' + Atlas.vector(embedding, 'storage') + Atlas.notice('Transparent toy encoder', 'This is keyword-derived vector retrieval, not a pretrained semantic embedding model. Cosine and ranking are computed; the answer is an extract, not a live LLM.', 'storage');
      const answer = results.length ? results[0].text + ' [' + results[0].id + ']' : 'No supporting passage was found. I cannot answer from this corpus.';
      root.querySelector('#rag-answer').innerHTML = '<div class="response-label"><span class="tiny-label">CITED EXTRACT / NOT A LIVE LLM</span></div><p>' + (current === stages.length - 1 && !ingestion ? escape(answer) : '<span class="response-placeholder">Evidence is assembled before an answer is returned.</span>') + '</p>';
      root.dataset.retrievedIds = JSON.stringify(results.map(document => document.id));
      root.dataset.ragAnswer = answer;
    } });
    root.addEventListener('input', () => player.seek(0));
    root.addEventListener('change', () => player.seek(0));
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.draw();
    return player;
  };
  Atlas.executeTool = (request, permissions = {}) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('A tool request must be an object.');
    if (typeof request.tool !== 'string') throw new Error('Required field: tool (string).');
    if (Object.keys(request).some(key => !['tool', 'arguments', 'location'].includes(key))) throw new Error('Unexpected top-level field.');
    const args = request.arguments ?? (request.location !== undefined ? { location: request.location } : {});
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments must be an object.');
    let result;
    if (request.tool === 'get_weather') {
      if (Object.keys(args).some(key => key !== 'location') || typeof args.location !== 'string') throw new Error('get_weather needs only a string location.');
      const fixtures = { bangalore: { location: 'Bangalore', temperatureC: 25, condition: 'Clear' }, london: { location: 'London', temperatureC: 12, condition: 'Cloudy' }, paris: { location: 'Paris', temperatureC: 16, condition: 'Clear' } };
      const location = args.location.toLowerCase();
      const fixture = Object.prototype.hasOwnProperty.call(fixtures, location) ? fixtures[location] : null;
      if (!fixture) throw new Error('Fixture locations: Bangalore, London, Paris. No live weather API is connected.');
      result = { ...fixture, source: 'Fictional demonstration fixture; not current weather' };
    } else if (request.tool === 'calculate') {
      if (Object.keys(args).some(key => !['a', 'b', 'operation'].includes(key)) || !Number.isFinite(args.a) || !Number.isFinite(args.b)) throw new Error('calculate requires finite numeric a and b, plus an operation.');
      const operations = { add: (left, right) => left + right, subtract: (left, right) => left - right, multiply: (left, right) => left * right, divide: (left, right) => left / right };
      if (!Object.prototype.hasOwnProperty.call(operations, args.operation)) throw new Error('Operation must be add, subtract, multiply, or divide.');
      if (args.operation === 'divide' && args.b === 0) throw new Error('Division by zero is not allowed.');
      const value = operations[args.operation](args.a, args.b);
      if (!Number.isFinite(value)) throw new Error('Arithmetic result must be finite.');
      result = { value, source: 'Actual local arithmetic' };
    } else if (request.tool === 'search_docs') {
      if (Object.keys(args).some(key => key !== 'query') || typeof args.query !== 'string' || args.query.length > 1000) throw new Error('search_docs requires a query string of at most 1,000 characters.');
      result = { documents: Atlas.retrieve(args.query), source: 'Actual search over the local fixture corpus' };
    } else if (request.tool === 'export_data') {
      if (!permissions.allowExport) throw new Error('Permission denied: the runtime requires explicit export authorization.');
      result = { status: 'Simulated approval only; no data was exported', rows: 0 };
    } else throw new Error('Tool is not in the runtime allowlist.');
    return { tool: request.tool, arguments: args, result };
  };
  Atlas.toolExamples = {
    weather: { tool: 'get_weather', location: 'Bangalore' },
    calculator: { tool: 'calculate', arguments: { a: 17, b: 23, operation: 'multiply' } },
    search: { tool: 'search_docs', arguments: { query: 'KV cache memory' } }
  };
  Atlas.simulations.tools = (root, topic) => {
    const panels = Atlas.layout(root, Atlas.select('tool-example', 'Structured request', [['weather', 'Weather fixture'], ['calculator', 'Actual calculator'], ['search', 'Local retrieval']], 'weather') + '<button class="small-button" id="execute-tool">' + Atlas.icon('terminal') + 'Execute local tool</button>');
    panels.visual.classList.add('content-visual');
    let result = null;
    let error = null;
    const player = Atlas.createPlayer({ length: topic.flow.length, onFrame(frame) {
      const existing = panels.visual.querySelector('#tool-json');
      if (!existing) panels.visual.innerHTML = '<label class="input-label" for="tool-json"><span>MODEL-PROPOSED JSON / EDITABLE EXAMPLE</span><textarea id="tool-json" class="sim-text-input code-input" rows="7" maxlength="4000">' + escape(JSON.stringify(Atlas.toolExamples.weather, null, 2)) + '</textarea></label><div id="tool-flow"></div>';
      panels.visual.querySelector('#tool-flow').innerHTML = Atlas.linearDiagram(topic.flow, frame, 'decision');
      Atlas.attachZoom(panels.visual);
      panels.inspector.innerHTML = Atlas.dataPanel(topic.flow[frame], 'A structured tool proposal', 'The runtime parses JSON, validates its allowlisted schema, checks permission, and calls the actual local function.', result ? '<strong>Completed: ' + result.tool + '</strong>' : error ? '<span class="error-message">' + escape(error) + '</span>' : 'No execution yet', 'agents') + '<h4>RUNTIME OBSERVATION</h4>' + (result ? '<pre>' + escape(JSON.stringify(result.result, null, 2)) + '</pre>' : '<p class="sim-caption">No tool result until execution is requested.</p>') + Atlas.notice('Tool execution is outside the LLM', 'Weather data is a static fictional fixture. Calculator and retrieval execute actual local functions. No backend, account, or remote service is connected.', 'decision');
      root.dataset.toolResult = JSON.stringify(result?.result ?? null);
      root.dataset.toolError = error || '';
    } });
    root.querySelector('#execute-tool').addEventListener('click', () => {
      try { result = Atlas.executeTool(JSON.parse(root.querySelector('#tool-json').value)); error = null; }
      catch (failure) { result = null; error = failure.message; }
      player.seek(result ? 5 : 3);
    });
    root.querySelector('#tool-example').addEventListener('change', event => { root.querySelector('#tool-json').value = JSON.stringify(Atlas.toolExamples[event.target.value], null, 2); result = null; error = null; player.seek(0); });
    root.addEventListener('input', event => { if (event.target.id === 'tool-json') { result = null; error = null; player.draw(); } });
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.reset = () => { result = null; error = null; player.seek(0); };
    player.draw();
    return player;
  };
  Atlas.simulations.agent = (root, topic) => {
    const controls = Atlas.select('agent-goal', 'Local example goal', [['combined', '7B FP16 weight memory + caching evidence'], ['arithmetic', 'Calculate 17 times 23'], ['cache', 'Find how KV cache works']], 'combined') + Atlas.slider('agent-budget', 'Tool-call budget', 3, 1, 4, 1);
    const panels = Atlas.layout(root, controls, '<div class="agent-trace" id="agent-trace"></div>');
    let plan;
    let observations = [];
    let sequence;
    function prepare() {
      const goal = root.querySelector('#agent-goal').value;
      plan = goal === 'arithmetic' ? [Atlas.toolExamples.calculator] : goal === 'cache' ? [Atlas.toolExamples.search] : [{ tool: 'calculate', arguments: { a: 7, b: 2, operation: 'multiply' } }, Atlas.toolExamples.search];
      const budget = Number(root.querySelector('#agent-budget').value);
      observations = [];
      sequence = [];
      for (let cycle = 0; cycle < Math.min(plan.length, budget); cycle++) for (let stage = cycle ? 1 : 0; stage < 7; stage++) sequence.push({ cycle, stage });
      sequence.push({ cycle: Math.min(plan.length, budget) - 1, stage: 7 });
    }
    prepare();
    const stages = [{ label: 'Goal', sub: 'BOUNDED TASK', color: 'data' }, { label: 'Planner', sub: 'SCRIPTED LOCAL POLICY', color: 'model' }, { label: 'Propose tool', sub: 'STRUCTURED ARGUMENTS', color: 'decision' }, { label: 'Runtime executes', sub: 'VALIDATE + AUTHORIZE', color: 'compute' }, { label: 'Observe', sub: 'ACTUAL LOCAL RESULT', color: 'data' }, { label: 'Verify', sub: 'CHECK COMPLETION', color: 'compute' }, { label: 'Continue?', sub: 'STOP CONDITIONS + BUDGET', color: 'decision' }, { label: 'Answer', sub: 'RETURN OR ABSTAIN', color: 'data' }];
    const player = Atlas.createPlayer({ length: sequence.length, interval: 700, onFrame(frame) {
      const current = sequence[frame];
      const call = plan[current.cycle];
      const eligible = current.stage >= 3 ? current.cycle + 1 : current.cycle;
      for (let index = 0; index < eligible; index++) if (!observations[index]) observations[index] = Atlas.executeTool(plan[index]);
      let diagram = Atlas.linearDiagram(stages, current.stage, 'decision');
      diagram = diagram.replace('</g></svg>', '<path class="flow-edge" d="M344,251 V285 H900 V18 H344 V38" stroke-dasharray="5 4"/><text class="diagram-note" x="625" y="278">YES / OBSERVATION UPDATES STATE</text></g></svg>');
      Atlas.paint(panels.visual, diagram);
      const observation = observations[current.cycle];
      const budgetStop = Number(root.querySelector('#agent-budget').value) < plan.length;
      const outputs = observations.slice(0, eligible).map(item => item.tool === 'calculate' ? String(item.result.value) + (root.querySelector('#agent-goal').value === 'combined' ? ' GB ideal FP16 weights for 7B parameters.' : '') : item.result.documents.length ? item.result.documents[0].text + ' [' + item.result.documents[0].id + ']' : 'No supporting document; abstain.');
      panels.inspector.innerHTML = Atlas.dataPanel(stages[current.stage].label, 'Goal + workflow state + prior observations', current.stage === 2 ? '<pre>' + escape(JSON.stringify(call, null, 2)) + '</pre>' : current.stage === 3 ? 'The local runtime checks the schema and invokes ' + call.tool + '.' : current.stage === 6 ? budgetStop ? 'Budget exhausted: return only completed work.' : current.cycle < plan.length - 1 ? 'More evidence is needed. Loop with the updated state.' : 'Goal checks passed. Stop.' : 'A deterministic planner for this selected example; not a live LLM.', current.stage === 7 ? '<strong>' + escape((budgetStop ? 'Partial result: action budget reached. ' : '') + outputs.join(' ')) + '</strong>' : current.stage >= 4 && observation ? '<pre>' + escape(JSON.stringify(observation.result, null, 2)) + '</pre>' : 'No observation at this point', 'tools') + '<div class="parameter-lock">' + Atlas.icon('shield-check') + 'READ-ONLY LOCAL TOOLS / NO EXTERNAL ACTIONS</div>';
      root.querySelector('#agent-trace').innerHTML = '<span class="tiny-label">EXECUTION TRACE / TOOL ' + (current.cycle + 1) + ' OF ' + Math.min(plan.length, Number(root.querySelector('#agent-budget').value)) + '</span><div class="trace-events">' + observations.slice(0, eligible).map((item, index) => '<div><span class="trace-number">' + (index + 1) + '</span><strong>' + item.tool + '</strong><span>validated &rarr; executed &rarr; observation stored</span></div>').join('') + (!eligible ? '<p class="sim-caption">No tool execution yet.</p>' : '') + '</div>';
      root.dataset.agentCalls = eligible;
      root.dataset.agentPartial = String(budgetStop);
    } });
    function update() { prepare(); player.length = sequence.length; player.seek(0); }
    root.addEventListener('input', update);
    root.addEventListener('change', update);
    root.addEventListener('click', event => {
      const node = event.target.closest('[data-node]');
      if (node) { const stage = Number(node.dataset.node); const current = sequence[player.frame]; const target = stage === 7 ? sequence.length - 1 : sequence.findIndex(item => item.cycle === current.cycle && item.stage === stage); if (target >= 0) player.seek(target); }
    });
    player.reset = () => { prepare(); player.length = sequence.length; player.seek(0); };
    player.draw();
    return player;
  };
  Atlas.simulations.mcp = (root) => {
    const panels = Atlas.layout(root, Atlas.select('mcp-capability', 'Server capability', [['tools', 'Tools / callable operations'], ['resources', 'Resources / readable context'], ['prompts', 'Prompts / message templates']], 'tools') + Atlas.select('mcp-server', 'Inspect server', [['database', 'Database'], ['code', 'Code repository'], ['files', 'Files']], 'database'));
    const player = Atlas.createPlayer({ length: 6, onFrame(frame) {
      const capability = root.querySelector('#mcp-capability').value;
      const selected = root.querySelector('#mcp-server').value;
      const servers = ['database', 'code', 'files'];
      let drawing = Atlas.node({ id: 'host', label: 'Agent application / host', sub: 'MODEL + POLICY + RUNTIME', x: 287, y: 28, width: 280, color: 'model', active: frame === 0 });
      drawing += Atlas.edge('M427,100 V137', frame >= 1) + Atlas.node({ id: 'client', label: 'Host-managed MCP clients', sub: 'ONE CONNECTION PER SERVER', x: 287, y: 143, width: 280, color: 'compute', active: frame >= 1 && frame <= 2 });
      servers.forEach((server, index) => { const x = 60 + index * 275; drawing += Atlas.edge('M427,215 V255 H' + (x + 96) + ' V285', frame >= 3); drawing += Atlas.node({ id: server, label: server === 'code' ? 'Code MCP server' : server === 'files' ? 'Files MCP server' : 'Database MCP server', sub: 'SCOPED ACCESS + VALIDATION', x, y: 291, width: 200, color: 'storage', active: selected === server }); drawing += Atlas.edge('M' + (x + 96) + ',363 V395', frame >= 4) + Atlas.node({ id: 'data-' + server, label: ['Read-only query', 'Repository data', 'Documents'][index], sub: 'UNDERLYING SYSTEM', x, y: 401, width: 200, height: 63, color: 'data' }); });
      drawing += '<text class="diagram-note" x="60" y="511">MCP STANDARDIZES ACCESS. HOST/SERVER POLICIES STILL CONTROL WHAT IS ALLOWED.</text>';
      const request = { jsonrpc: '2.0', id: 1, method: capability + '/list' };
      const response = capability === 'tools' ? { tools: [{ name: selected === 'database' ? 'query_readonly' : selected === 'code' ? 'read_file' : 'read_document', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } }] } : capability === 'resources' ? { resources: [{ uri: 'atlas://handbook', name: 'Engineering handbook', mimeType: 'text/plain' }] } : { prompts: [{ name: 'review_query', description: 'Prepare a review request', arguments: [{ name: 'query', required: true }] }] };
      panels.visual.innerHTML = Atlas.svg(drawing, 900, 545, 'An MCP host client connecting to scoped servers and their underlying systems') + '<div class="protocol-exchange"><div><span class="tiny-label">CLIENT REQUEST</span><pre>' + escape(JSON.stringify(request, null, 2)) + '</pre></div><div><span class="tiny-label">SERVER RESULT PAYLOAD</span><pre>' + escape(JSON.stringify(response, null, 2)) + '</pre></div></div>';
      Atlas.attachZoom(panels.visual);
      const stages = ['Host chooses context', 'Initialize + negotiate', 'Discover capabilities', 'Validate request', 'Execute/read server capability', 'Result to host'];
      panels.inspector.innerHTML = Atlas.dataPanel(stages[frame], 'An application request, not a neural-network layer', capability === 'tools' ? 'Discover callable schemas. For use, the client sends tools/call with name and arguments.' : capability === 'resources' ? 'Discover resource URIs. Read with resources/read.' : 'Discover templates. Obtain a template with prompts/get.', 'A structured result managed by the host', 'tools') + '<pre>' + escape(JSON.stringify(capability === 'tools' ? { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: response.tools[0].name, arguments: { query: 'Example read-only request' } } } : { jsonrpc: '2.0', id: 2, method: capability === 'resources' ? 'resources/read' : 'prompts/get', params: capability === 'resources' ? { uri: 'atlas://handbook' } : { name: 'review_query', arguments: { query: 'Example query' } } }, null, 2)) + '</pre><p class="sim-caption">Protocol illustration only. No MCP server or account is connected. Stdio and Streamable HTTP are transport choices; neither grants automatic permission.</p>';
    } });
    root.addEventListener('change', () => player.seek(0));
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node && ['database', 'code', 'files'].includes(node.dataset.node)) { root.querySelector('#mcp-server').value = node.dataset.node; player.draw(); } });
    player.draw();
    return player;
  };
  Atlas.simulations.knowledge = (root) => {
    const panels = Atlas.layout(root, Atlas.select('knowledge-mode', 'Retrieval approach', [['graph', 'Knowledge graph'], ['vector', 'Vector search'], ['hybrid', 'Hybrid graph + vector']], 'graph'));
    let selectedEdge = 0;
    const relations = [
      { from: 'Acme Corp', edge: 'employs (illustrative)', to: 'Data engineer' },
      { from: 'Data engineer', edge: 'works_with', to: 'Apache Spark' },
      { from: 'Apache Spark', edge: 'reads', to: 'Parquet files' }
    ];
    const player = Atlas.createPlayer({ length: 4, onFrame(frame) {
      const mode = root.querySelector('#knowledge-mode').value;
      let drawing = '';
      if (mode !== 'vector') {
        const entities = ['Acme Corp', 'Data engineer', 'Apache Spark', 'Parquet files'];
        drawing += entities.map((entity, index) => Atlas.node({ id: String(index), label: entity, sub: ['FICTIONAL COMPANY', 'ROLE', 'PROCESSING ENGINE', 'FILE FORMAT'][index], x: 35 + index * 215, y: 115, width: 163, color: 'storage', active: frame === index })).join('');
        relations.forEach((relation, index) => { const start = 35 + index * 215; drawing += '<g data-relation="' + index + '" role="button" tabindex="0" aria-label="Inspect ' + escape(relation.edge) + '"><title>Illustrative relationship: ' + escape(relation.from + ' ' + relation.edge + ' ' + relation.to) + '</title>' + Atlas.edge('M' + (start + 163) + ',151 H' + (start + 209), index <= frame) + '<text class="edge-label" x="' + (start + 176) + '" y="101" text-anchor="middle">' + (index === 0 ? 'employs*' : relation.edge) + '</text></g>'; });
        drawing += '<text class="diagram-note" x="35" y="236">* FICTIONAL COMPANY; THE RELATIONSHIPS ARE ILLUSTRATIVE.</text>';
      }
      if (mode === 'vector') drawing += Atlas.linearDiagram(['Question', 'Query vector', 'Nearest documents', 'Semantic evidence'], Math.min(3, frame), 'data').match(/<g class="zoom-layer">([\s\S]*)<\/g><\/svg>/)[1];
      if (mode === 'hybrid') drawing += Atlas.node({ id: 'vector', label: 'Vector retrieval', sub: 'RELATED TEXT PASSAGES', x: 35, y: 294, width: 200, color: 'data' }) + Atlas.edge('M235,330 H343', frame >= 2) + Atlas.node({ id: 'combine', label: 'Combined evidence', sub: 'RELATIONSHIPS + TEXT', x: 349, y: 294, width: 220, color: 'compute' }) + Atlas.edge('M569,330 H674', frame >= 3) + Atlas.node({ id: 'llm', label: 'Grounded response', sub: 'VERIFY + CITE', x: 680, y: 294, width: 180, color: 'model' }) + Atlas.edge('M460,187 V288', frame >= 2);
      if (mode === 'graph') drawing += '<text class="chart-title" x="35" y="301">Explicit traversal</text><text class="chart-label" x="35" y="333">Acme Corp &#8594; Data engineer &#8594; Apache Spark &#8594; Parquet files</text><text class="diagram-note" x="35" y="390">EXACT RELATIONSHIP QUESTIONS REQUIRE VALIDATED EDGES AND PROVENANCE.</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 915, 450, 'Explicit entity relationships compared with vector and hybrid retrieval'));
      const relation = relations[selectedEdge];
      panels.inspector.innerHTML = Atlas.dataPanel(mode === 'vector' ? 'Similarity is not a relationship edge' : 'Inspect an explicit relationship', mode === 'vector' ? 'Query and document embeddings' : escape(relation.from), mode === 'vector' ? 'Find nearby vectors for approximate semantic matching.' : escape(relation.edge), mode === 'vector' ? 'Candidate documents; not a verified graph relation' : escape(relation.to), 'rag') + Atlas.notice('Different strengths', mode === 'graph' ? 'Graphs support relationship traversal and constraints. Their assertions still need reliable sources and updates.' : mode === 'vector' ? 'Vectors support related meaning and fuzzy matching. They do not store explicit typed relations by themselves.' : 'Hybrid systems can use graph structure and semantic text retrieval together, with source checks for both.', 'storage');
    } });
    root.addEventListener('change', () => player.seek(0));
    root.addEventListener('click', event => { const relation = event.target.closest('[data-relation]'); if (relation) { selectedEdge = Number(relation.dataset.relation); player.seek(selectedEdge + 1); } });
    player.draw();
    return player;
  };
  Atlas.simulations.memory = (root) => {
    const memories = [
      ['Context memory', 'Current request', 'Input token sequence + KV tensors', 'No', 'Only available context can directly inform the next token.'],
      ['Conversation history', 'Across messages / sessions', 'Application message store', 'No', 'Stored messages must be selected and included in a future prompt.'],
      ['External / vector memory', 'Application-defined retention', 'Vector index + source documents', 'No', 'Retrieval finds selected records to include in context.'],
      ['Agent state', 'Workflow lifetime', 'In-memory or persistent state store', 'No', 'Tracks goal, observations, pending actions, and completion checks.'],
      ['Knowledge base', 'Long-lived, updated externally', 'Database / graph / document store', 'No', 'Explicit information with permissions, provenance, and freshness.'],
      ['Learned parameters', 'Model artifact lifetime', 'Checkpoint and accelerator weights', 'Training only', 'Statistical patterns encoded by learning, not database rows.']
    ];
    const panels = Atlas.layout(root, Atlas.select('memory-type', 'Inspect a mechanism', memories.map((memory, index) => [index, memory[0]]), 0), '<div class="metrics-row" id="memory-metrics"></div>');
    const player = Atlas.createPlayer({ length: memories.length, onFrame(frame) {
      const index = frame;
      const current = memories[index];
      root.querySelector('#memory-type').value = index;
      Atlas.paint(panels.visual, Atlas.linearDiagram(memories.map((memory, memoryIndex) => ({ label: memory[0], sub: memoryIndex === 5 ? 'LEARNED DURING TRAINING' : 'APPLICATION / REQUEST DATA', color: memoryIndex === 5 ? 'model' : 'storage' })), index, 'storage').replaceAll('marker-end=', 'data-unused-marker='));
      panels.inspector.innerHTML = Atlas.dataPanel(current[0], current[2], current[4], 'Lifetime: <strong>' + current[1] + '</strong><br>Updates learned weights? <strong>' + current[3] + '</strong>', index === 5 ? 'training' : index === 0 ? 'context' : 'rag') + Atlas.notice('Different mechanisms, not one memory organ', 'Saving a chat or retrieving a document does not update neural weights. KV caching reuses computation, while response caching reuses an application output.', 'storage');
      root.querySelector('#memory-metrics').innerHTML = Atlas.metric('Mechanism', current[0], index === 5 ? 'model' : 'storage') + Atlas.metric('Lifetime', current[1], 'storage') + Atlas.metric('Changes learned weights', current[3], index === 5 ? 'compute' : 'data');
    } });
    root.addEventListener('change', event => { if (event.target.id === 'memory-type') player.seek(Number(event.target.value)); });
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.draw();
    return player;
  };
})();