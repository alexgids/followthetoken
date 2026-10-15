(function () {
  'use strict';
  const Atlas = window.AIAtlas;
  const escape = Atlas.escape;
  Atlas.simulations.pipeline = (root, topic) => {
    const panels = Atlas.layout(root, Atlas.slider('target-probability', 'Probability of correct target', 0.65, 0.01, 0.99, 0.01) + Atlas.select('train-view', 'Inspect', [['targets', 'Shifted next-token targets'], ['optimizer', 'Optimizer state'], ['validation', 'Validation + checkpoints']], 'targets'), '<div class="metrics-row" id="training-metrics"></div>');
    const details = [
      ['Raw documents', 'Collect data with provenance, rights, and coverage.', 'Candidate training corpus'],
      ['Candidate corpus', 'Filter, deduplicate, and split into training/validation sets.', 'Clean corpus; contamination checks'],
      ['Text sequences', 'Run the model\'s fixed tokenizer.', 'Token-ID sequences'],
      ['Token IDs', 'Batch examples and align input positions with shifted target labels.', 'Causal inputs and next-token targets'],
      ['Input batch + current parameters', 'Predict vocabulary logits for many allowed positions in parallel.', 'Per-position distributions'],
      ['Predicted probabilities + target IDs', 'Cross entropy = negative log probability of the correct target.', 'A scalar loss'],
      ['Loss + saved computation graph', 'Use the chain rule to propagate derivatives backward.', 'Gradients for trainable parameters'],
      ['Gradients + optimizer state', 'AdamW uses moving gradient moments, a learning rate, and decoupled weight decay.', 'Updated parameters and optimizer state'],
      ['Model + held-out data', 'Track validation, save checkpoints, and apply a learning-rate schedule.', 'Measured progress and resumable artifacts']
    ];
    const player = Atlas.createPlayer({ length: topic.flow.length, onFrame(frame) {
      const probability = Number(root.querySelector('#target-probability').value);
      const view = root.querySelector('#train-view').value;
      const loss = -Math.log(probability);
      let extra = '';
      if (view === 'targets') {
        extra = '<div class="training-targets"><div><span class="tiny-label">INPUT POSITIONS</span>' + ['The', ' cat', ' sat', ' on', ' the'].map(piece => Atlas.chip(piece, 'data')).join(' ') + '</div><div><span class="tiny-label">SHIFTED TARGETS</span>' + [' cat', ' sat', ' on', ' the', ' mat'].map(piece => Atlas.chip(piece, 'storage')).join(' ') + '</div><p class="sim-caption">Teacher-forced causal training predicts many shifted targets in one batched forward pass.</p></div>';
      } else if (view === 'optimizer') extra = '<div class="training-targets">' + Atlas.equation('m_t=\\beta_1m_{t-1}+(1-\\beta_1)g_t') + Atlas.equation('v_t=\\beta_2v_{t-1}+(1-\\beta_2)g_t^2') + '<p class="sim-caption">Adam estimates first and second gradient moments. AdamW adds decoupled weight decay; bias correction and epsilon are omitted from this compact view.</p></div>';
      else extra = '<div class="training-targets">' + Atlas.notice('Validation is not another training update', 'Evaluate on held-out examples without applying their gradients. Save checkpoints containing weights, configuration, and, when needed for resuming, optimizer and scheduler states.', 'storage') + '</div>';
      panels.visual.innerHTML = Atlas.linearDiagram(topic.flow, frame, 'compute') + extra;
      Atlas.attachZoom(panels.visual);
      Atlas.renderMath(panels.visual);
      panels.inspector.innerHTML = Atlas.dataPanel(topic.flow[frame], escape(details[frame][0]), escape(details[frame][1]), escape(details[frame][2]) + (frame === 5 ? '<br><strong>loss = ' + Atlas.format(loss, 4) + ' nats</strong>' : ''), frame >= 6 && frame <= 7 ? 'optimization' : 'tokens') + '<p class="sim-caption">The slider changes a hypothetical predicted target probability. Only its cross entropy is calculated; this page does not train a real LLM.</p>';
      root.querySelector('#training-metrics').innerHTML = Atlas.metric('Target probability', Atlas.format(probability * 100, 1) + '%', 'data') + Atlas.metric('Cross entropy', Atlas.format(loss, 4), 'error') + Atlas.metric('Parameter lifecycle', 'Updated', 'compute');
      root.dataset.crossEntropy = loss;
    } });
    root.addEventListener('input', () => player.draw());
    root.addEventListener('change', () => player.draw());
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.draw();
    return player;
  };
  Atlas.simulations.alignment = (root) => {
    const controls = Atlas.select('alignment-method', 'Post-training route', [['rlhf', 'Reward-model + RL'], ['dpo', 'DPO / direct preferences'], ['sft', 'SFT only']], 'rlhf') + Atlas.select('feedback-source', 'Preference feedback source', [['human', 'Human preferences'], ['ai', 'AI feedback / RLAIF']], 'human');
    const panels = Atlas.layout(root, controls);
    const player = Atlas.createPlayer({ length: 8, onFrame(frame) {
      const method = root.querySelector('#alignment-method').value;
      const ai = root.querySelector('#feedback-source').value === 'ai';
      const common = ['Initialize parameters', 'Pretraining', 'Base model', 'Instruction demonstrations', 'SFT model'];
      const tail = method === 'rlhf' ? [ai ? 'AI preferences' : 'Human preferences', 'Train reward model', 'RL policy optimization', 'Evaluate + deploy'] : method === 'dpo' ? [ai ? 'AI preference pairs' : 'Human preference pairs', 'Direct preference objective', 'Evaluate + deploy'] : ['Evaluate + deploy'];
      const stages = [...common, ...tail];
      player.length = stages.length;
      player.frame = Math.min(player.frame, player.length - 1);
      const current = Math.min(frame, stages.length - 1);
      Atlas.paint(panels.visual, Atlas.linearDiagram(stages, current, 'model'));
      const explanation = method === 'sft' ? 'Demonstrations train the model to predict desired responses. This route does not use a preference-optimization step.' : method === 'dpo' ? 'Chosen/rejected pairs directly optimize a preference objective. No separate online reward-model RL loop is shown.' : 'A reward model learns preference scores; a policy optimizer uses those scores with controls such as regularization.';
      panels.inspector.innerHTML = Atlas.dataPanel(stages[current], current ? escape(stages[current - 1]) : 'Untrained parameters', explanation, current < 2 ? 'Broad predictive capabilities' : 'A changed model artifact', method === 'rlhf' ? 'rl' : 'training') + Atlas.notice(ai && method !== 'sft' ? 'RLAIF is a feedback source' : 'Not a universal recipe', ai && method !== 'sft' ? 'AI-generated preferences can be used with different optimization algorithms. Feedback source and optimization method are separate choices.' : 'Some models skip stages, use adapters, mix objectives, or apply additional safety/domain training. This route is one illustration.', 'model') + '<div class="preference-pair"><span class="tiny-label">EXAMPLE PREFERENCE PAIR</span><div><span class="group-dot" style="background:var(--storage)"></span>Chosen: supported answer with uncertainty.</div><div><span class="group-dot" style="background:var(--error)"></span>Rejected: confident unsupported claim.</div></div>';
      root.dataset.alignmentStages = JSON.stringify(stages);
    } });
    root.addEventListener('change', () => player.seek(0));
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.draw();
    return player;
  };
  Atlas.createGridLearner = (epsilon = 0.2) => {
    const side = 4;
    const goal = 15;
    const wall = 5;
    const penalty = 10;
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const environment = {
      getNumStates: () => side * side,
      getMaxNumActions: () => 4,
      allowedActions(state) {
        if (state === goal || state === wall) return [];
        const column = state % side;
        const row = Math.floor(state / side);
        return directions.flatMap(([horizontal, vertical], action) => {
          const nextColumn = column + horizontal;
          const nextRow = row + vertical;
          return nextColumn >= 0 && nextColumn < side && nextRow >= 0 && nextRow < side && nextRow * side + nextColumn !== wall ? [action] : [];
        });
      },
      next(state, action) { return state + directions[action][0] + directions[action][1] * side; },
      reward(state) { return state === goal ? 10 : state === penalty ? -4 : -0.1; }
    };
    const agent = new window.RL.TDAgent(environment, { update: 'qlearn', alpha: 0.2, gamma: 0.9, epsilon, lambda: 0, planN: 0 });
    let episodes = 0;
    const random = Atlas.math.seed(42);
    function policyAction(state, explore) {
      const actions = environment.allowedActions(state);
      if (!actions.length) return null;
      if (explore && random() < agent.epsilon) return actions[Math.floor(random() * actions.length)];
      if (explore) return actions[Atlas.math.sample(actions.map(action => agent.P[action * 16 + state]), random())];
      return actions.reduce((best, action) => agent.Q[action * 16 + state] > agent.Q[best * 16 + state] ? action : best, actions[0]);
    }
    return {
      environment, agent,
      get episodes() { return episodes; },
      train(count) {
        let successes = 0;
        for (let episode = 0; episode < count; episode++) {
          let state = 0;
          for (let step = 0; step < 120 && state !== goal; step++) {
            const action = policyAction(state, true);
            const next = environment.next(state, action);
            agent.learnFromTuple(state, action, environment.reward(next), next, 0, 0);
            state = next;
          }
          if (state === goal) successes++;
          episodes++;
        }
        return successes;
      },
      rollout() {
        const trajectory = [{ state: 0, action: null, reward: 0, total: 0 }];
        let state = 0;
        let total = 0;
        for (let step = 0; step < 20 && state !== goal; step++) {
          const action = policyAction(state, false);
          state = environment.next(state, action);
          const reward = environment.reward(state);
          total += reward;
          trajectory.push({ state, action, reward, total });
        }
        return trajectory;
      },
      bestAction: state => policyAction(state, false),
      reset() { agent.reset(); episodes = 0; }
    };
  };
  Atlas.simulations.rl = (root) => {
    const panels = Atlas.layout(root, Atlas.slider('rl-epsilon', 'Exploration probability', 0.2, 0, 1, 0.05) + '<button class="small-button" id="train-policy">' + Atlas.icon('graduation-cap') + 'Train 200 episodes</button><span class="sim-caption">ReinforceJS / tabular Q-learning</span>', '<div class="metrics-row" id="rl-metrics"></div>');
    const learner = Atlas.createGridLearner();
    let trajectory = learner.rollout();
    const arrowCharacters = ['&#8593;', '&#8594;', '&#8595;', '&#8592;'];
    const actionNames = ['up', 'right', 'down', 'left'];
    const player = Atlas.createPlayer({ length: trajectory.length, interval: 550, onFrame(frame) {
      const current = trajectory[frame];
      let drawing = '<text class="chart-title" x="174" y="34">Reach the goal. Avoid the penalty.</text>';
      for (let state = 0; state < 16; state++) {
        const column = state % 4;
        const row = Math.floor(state / 4);
        const x = 180 + column * 108;
        const y = 68 + row * 108;
        const visited = trajectory.slice(0, frame + 1).some(step => step.state === state);
        const color = state === 15 ? 'storage' : state === 10 ? 'error' : 'data';
        drawing += '<rect x="' + x + '" y="' + y + '" width="99" height="99" rx="4" fill="' + (state === 5 ? 'var(--line)' : visited ? 'color-mix(in srgb,var(--' + color + ') 7%,var(--surface))' : 'var(--surface)') + '" stroke="var(--line)"/><text class="chart-label" x="' + (x + 10) + '" y="' + (y + 19) + '">s' + state + '</text>';
        if (state === 15) drawing += '<path d="M' + (x + 45) + ',' + (y + 34) + ' v39 m0,-39 h27 l-8,10 8,10 h-27" fill="none" stroke="var(--storage)" stroke-width="3"/><text class="chart-label" x="' + (x + 56) + '" y="' + (y + 89) + '" text-anchor="middle">GOAL +10</text>';
        else if (state === 10) drawing += '<text x="' + (x + 48) + '" y="' + (y + 62) + '" fill="var(--error)" font-size="20" text-anchor="middle">-4</text>';
        else if (state === 5) drawing += '<path d="M' + (x + 22) + ',' + (y + 22) + ' l56,56 m-56,0 56,-56" stroke="var(--muted)" stroke-width="2"/>';
        else if (learner.episodes && state !== current.state) drawing += '<text x="' + (x + 48) + '" y="' + (y + 63) + '" fill="var(--muted)" font-size="25" text-anchor="middle">' + arrowCharacters[learner.bestAction(state)] + '</text>';
      }
      const robotX = 180 + current.state % 4 * 108 + 50;
      const robotY = 68 + Math.floor(current.state / 4) * 108 + 54;
      drawing += '<g><rect x="' + (robotX - 18) + '" y="' + (robotY - 15) + '" width="36" height="31" rx="5" fill="var(--compute)"/><circle cx="' + (robotX - 7) + '" cy="' + (robotY - 3) + '" r="3" fill="var(--surface)"/><circle cx="' + (robotX + 7) + '" cy="' + (robotY - 3) + '" r="3" fill="var(--surface)"/><path d="M' + robotX + ',' + (robotY - 15) + ' v-9" stroke="var(--compute)" stroke-width="2"/></g><text class="diagram-note" x="180" y="538">STEP COST -0.1 / WALL IS NOT TRAVERSABLE / ARROWS SHOW GREEDY POLICY</text>';
      Atlas.paint(panels.visual, Atlas.svg(drawing, 780, 565, 'A robot following a learned tabular policy through a four-by-four environment'));
      const values = [0, 1, 2, 3].map(action => learner.agent.Q[action * 16 + current.state]);
      panels.inspector.innerHTML = Atlas.dataPanel('State ' + current.state, 'A grid position and available actions', current.action === null ? 'Select an action from the current policy.' : 'Action: <strong>' + actionNames[current.action] + '</strong>', 'Reward: <strong>' + Atlas.format(current.reward, 1) + '</strong><br>Total return: ' + Atlas.format(current.total, 1), 'finetuning') + '<h4>Q-VALUES AT THIS STATE</h4><table class="data-table">' + actionNames.map((name, action) => '<tr><th>' + name + '</th><td>' + (learner.environment.allowedActions(current.state).includes(action) ? Atlas.format(values[action], 3) : 'unavailable') + '</td></tr>').join('') + '</table>' + '<p class="sim-caption">Training changes Q-values. Playback uses the current learned policy without updating it.</p>';
      const reachesGoal = trajectory.at(-1).state === 15;
      root.querySelector('#rl-metrics').innerHTML = Atlas.metric('Training episodes', learner.episodes, 'compute') + Atlas.metric('Playback step', frame, 'data') + Atlas.metric('Greedy rollout', reachesGoal ? 'Reaches goal' : 'Budget exhausted', reachesGoal ? 'storage' : 'error');
      root.dataset.reachesGoal = String(reachesGoal);
      root.dataset.episodes = learner.episodes;
    } });
    root.querySelector('#train-policy').addEventListener('click', () => {
      player.pause();
      learner.agent.epsilon = Number(root.querySelector('#rl-epsilon').value);
      learner.train(200);
      trajectory = learner.rollout();
      player.length = trajectory.length;
      player.seek(0);
    });
    player.reset = () => { learner.reset(); trajectory = learner.rollout(); player.length = trajectory.length; player.seek(0); };
    player.draw();
    return player;
  };
  Atlas.simulations.reasoning = (root, topic) => {
    const panels = Atlas.layout(root, Atlas.select('reasoning-strategy', 'Computation strategy', [['single', 'One candidate'], ['verify', 'Candidates + deterministic verification']], 'verify') + Atlas.slider('reasoning-budget', 'Candidate budget', 3, 1, 5, 1));
    const candidates = [382, 391, 399, 381, 392];
    const expected = 17 * 23;
    const player = Atlas.createPlayer({ length: 6, onFrame(frame) {
      const verify = root.querySelector('#reasoning-strategy').value === 'verify';
      const budget = verify ? Number(root.querySelector('#reasoning-budget').value) : 1;
      const considered = candidates.slice(0, budget);
      const valid = verify ? considered.find(value => value === expected) : undefined;
      const output = verify ? valid === undefined ? 'No verified candidate. Abstain.' : String(valid) : String(considered[0]);
      const stages = verify ? topic.flow : ['Question', 'One candidate', 'No independent check', 'Return candidate'];
      Atlas.paint(panels.visual, Atlas.linearDiagram(stages, Math.min(frame, stages.length - 1), 'decision'));
      panels.inspector.innerHTML = Atlas.dataPanel('17 times 23', 'A small arithmetic question', verify ? 'Generate up to ' + budget + ' scripted candidates and check equality against actual local multiplication.' : 'Return the first scripted candidate without checking.', frame >= (verify ? 4 : 3) ? '<strong>' + output + '</strong>' : 'Working through the workflow', 'tools') + '<h4>CANDIDATES</h4><table class="data-table">' + considered.map(value => '<tr><td>' + value + '</td><td>' + (verify && frame >= 3 ? value === expected ? '<span class="pass-label">Verified</span>' : '<span class="fail-label">Rejected</span>' : 'Unchecked') + '</td></tr>').join('') + '</table><p class="sim-caption">A visible scripted workflow, not the internal reasoning trace of a live language model. More candidates cost more; verification is what rejects the wrong ones.</p>';
      root.dataset.reasoningResult = output;
    } });
    root.addEventListener('input', () => player.draw());
    root.addEventListener('change', () => player.seek(0));
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.draw();
    return player;
  };
})();