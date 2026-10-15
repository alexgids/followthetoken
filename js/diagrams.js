(function () {
  'use strict';
  const Atlas = window.AIAtlas;
  Atlas.paint = (element, html) => {
    const previous = element.querySelector('svg.zoomable');
    const transform = previous?.__zoom;
    element.innerHTML = html;
    Atlas.attachZoom(element);
    if (transform) {
      const next = element.querySelector('svg.zoomable');
      if (next?.atlasZoom) window.d3.select(next).call(next.atlasZoom.transform, transform);
    }
  };
  Atlas.layout = (root, controls = '', extra = '') => {
    root.innerHTML = (controls ? '<div class="sim-controls">' + controls + '</div>' : '') + '<div class="simulation-grid"><div class="sim-visual visual-stage" id="sim-visual"></div><aside class="sim-inspector" id="sim-inspector" aria-label="Intermediate state"></aside></div>' + extra;
    Atlas.bindInputs(root);
    return { visual: root.querySelector('#sim-visual'), inspector: root.querySelector('#sim-inspector') };
  };
  Atlas.dataPanel = (label, input, transformation, output, connection = '') => '<div class="inspector-heading"><span class="tiny-label">CURRENT STATE</span><h3>' + Atlas.escape(label) + '</h3></div><dl class="data-inspector"><dt>INPUT</dt><dd>' + input + '</dd><dt>TRANSFORMATION</dt><dd>' + transformation + '</dd><dt>OUTPUT</dt><dd>' + output + '</dd></dl>' + (connection ? '<a class="inspect-link" href="#' + connection + '">Explore ' + Atlas.escape(Atlas.byId[connection]?.title || connection) + Atlas.icon('arrow-up-right') + '</a>' : '');
  Atlas.flowSimulation = (root, topic, detail) => {
    const panels = Atlas.layout(root);
    const player = Atlas.createPlayer({ length: topic.flow.length, onFrame(frame) {
      Atlas.paint(panels.visual, Atlas.linearDiagram(topic.flow, frame, topic.color));
      const current = detail ? detail(frame) : {
        input: Atlas.escape(frame ? topic.flow[frame - 1] : 'Input data'),
        transformation: Atlas.escape(topic.flow[frame]),
        output: Atlas.escape(frame < topic.flow.length - 1 ? 'Input to ' + topic.flow[frame + 1] : 'Final result')
      };
      panels.inspector.innerHTML = Atlas.dataPanel(topic.flow[frame], current.input, current.transformation, current.output, current.connection || '') + '<div class="inspector-note">' + Atlas.escape(topic.systems) + '</div>';
      Atlas.icons();
    } });
    root.addEventListener('click', event => { const node = event.target.closest('[data-node]'); if (node) player.seek(Number(node.dataset.node)); });
    player.draw();
    return player;
  };
  Atlas.simulations.generic = (root, topic) => Atlas.flowSimulation(root, topic);
  Atlas.mountSimulation = (root, topic) => (Atlas.simulations[topic.kind] || Atlas.simulations.generic)(root, topic);
})();