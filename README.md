# Follow the Token

How AI actually works, at [followthetoken.com](https://followthetoken.com/): a standalone, connected visual mental model of modern AI. Open [index.html](index.html) directly in Chrome, Edge, or another modern browser. No build, server, account, API key, or network connection is required.

The first screen is a working **Follow the Data** visualization. The sidebar links all 36 concept pages, the complete ecosystem map, a 116-term glossary, and learning paths. Each concept has connected breadcrumbs, an interactive diagram, intuition/technical/systems explanations, mathematics, an example, physical locations, and related concepts.

## Included

- Editable neural-network weights, activations, and output probabilities.
- Gradient descent with stable and unstable learning rates.
- Real `cl100k_base` byte-pair tokenization, including custom text.
- Editable illustrative embedding vectors and calculated cosine similarity.
- Transformer block inspection, causal Q/K/V matrices, multiple heads, FFNs, residuals, normalization, and positions.
- Token-by-token scripted generation; temperature, top-k, and top-p sampling.
- Pretraining and shifted targets, cross entropy, SFT/preference routes, and real tabular Q-learning.
- Serving/batching, GPU sharding budgets, KV caching, low-bit vector reconstruction, MoE routing, and context policies.
- Local vector/lexical/hybrid retrieval, chunking, metadata filters, and a toy reranker.
- Schema-validated local tools, bounded agent loops, MCP messages, graphs, and memory mechanisms.
- Actual local fixture evaluations, reward hacking, hallucination/grounding, permission gates, and production architecture.
- Play/pause, bidirectional stepping, speed, reset, zoom/pan, theme persistence, search, and per-topic learning progress.

## What Is Real

The tokenizer uses an actual BPE vocabulary; known IDs are tested. Neural, attention, FFN, normalization, cosine, gradient, sampling, memory, router, quantization, retrieval, calculator, and Q-learning operations are calculated in the browser.

**There is no trained LLM running in this application.** Forward-pass answers, weather, reasoning candidates, production traces, and serving timings are explicitly labeled fixtures or conceptual simulations. Embedding plots are hand-placed, and the retrieval encoder uses transparent keyword features, not a trained semantic encoder. Floating-point rounding is not simulated. Weight-byte estimates exclude format metadata; GPU overhead is an explicit assumed budget. Toy scores are not commercial-model benchmark results.

Training/inference, weights/activations, embeddings/hidden states, context/parameters, RAG/fine-tuning, tool proposal/execution, graph/vector retrieval, model/agent capability, and general RL/RLHF are distinguished throughout. Some simplifications omit biases, gates, kernel details, padding, collectives, and other production-specific implementation details.

Nothing typed here is sent to an AI service. Learning status, explanation preferences, and theme are saved in browser `localStorage`; they are browser/device specific. Private-mode or restricted file storage can prevent persistence. Clear this app's site data to erase it.

## Source Layout

| File | Responsibility |
| --- | --- |
| [js/concepts.js](js/concepts.js) | Concept definitions, relationships, glossary, learning paths |
| [js/core.js](js/core.js) | Numerical functions, tokenization, state, SVG, transport, zoom |
| [js/diagrams.js](js/diagrams.js) | Shared simulation layout and state inspectors |
| [js/simulations-foundations.js](js/simulations-foundations.js) | Hierarchy, neural networks, optimization, tokens, embeddings |
| [js/simulations-transformers.js](js/simulations-transformers.js) | Architecture, attention, FFN, positions, sampling, forward pass |
| [js/simulations-learning.js](js/simulations-learning.js) | LLM training, preferences, RL, verified candidates |
| [js/simulations-systems.js](js/simulations-systems.js) | Serving, GPUs, KV, quantization, MoE, context |
| [js/simulations-applications.js](js/simulations-applications.js) | RAG, tools, agents, MCP, graphs, memory |
| [js/simulations-production.js](js/simulations-production.js) | Evaluations, failure modes, controls, enterprise architecture |
| [js/simulations-map.js](js/simulations-map.js) | Zoomable full ecosystem map |
| [js/app.js](js/app.js) | Hash routes, shared UI, progressive disclosure, progress |
| [tests/run.cjs](tests/run.cjs) | Offline browser regression tests and responsive screenshots |
| [scripts/build_site.py](scripts/build_site.py) | Public `dist/` package for static hosting |

## Publishing

The app is static, so any static host works. Build the public copy with Python 3 (standard library only), using the final site URL:

```powershell
python scripts/build_site.py --url https://followthetoken.com/
```

`dist/` contains only runtime files, absolute canonical and social-preview URLs, `robots.txt`, `sitemap.xml`, `404.html`, and `_headers` security headers. Rebuild whenever the URL changes. To test a served build, run the suite with `ATLAS_URL` set to the local site URL and `ATLAS_HEADERS` set to `dist/_headers`.

The live site deploys with Cloudflare Workers Builds on every push to `main`: build command `python3 scripts/build_site.py --url https://followthetoken.com/`, deploy command `npx wrangler deploy`. [wrangler.jsonc](wrangler.jsonc) publishes only `dist/` as static assets and serves `404.html` for unknown paths.

## Optional Regression Tests

Node.js is needed only for development tests, not to use the app:

```powershell
npm install
npm test
```

The runner uses installed Chrome/Edge on Windows. If no system browser is available, run `npx playwright install chromium` first. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select a browser binary. Test screenshots and the JSON report are written to `tests/artifacts/`.

## Bundled Libraries

Local assets are used instead of CDNs at runtime. Upstream code is unmodified.

| Library | Version / source | Purpose |
| --- | --- | --- |
| D3 | 7.9.0 | Zoom and pan |
| Lucide | 1.52.0 | Consistent interface icons |
| KaTeX | 0.19.0 | Local mathematics rendering |
| gpt-tokenizer | 2.1.2, `cl100k_base` browser bundle | Real BPE encoding |
| ReinforceJS | Vendored upstream `lib/rl.js` | Tabular Q-learning engine |
| Manrope / IBM Plex Mono | Fontsource Latin webfonts | Interface and numerical typography |

The `gpt-tokenizer` 3.4.0 browser artifact labeled `cl100k_base` returned another encoding during verification. The older cl100k-only build is pinned and checked against canonical IDs (`hi` is 6151).

See [THIRD_PARTY.md](THIRD_PARTY.md) for source and license information.

## Further Reading

- [Attention Is All You Need](https://arxiv.org/abs/1706.03762)
- [RoFormer / rotary position embeddings](https://arxiv.org/abs/2104.09864)
- [Grouped-query attention](https://arxiv.org/abs/2305.13245)
- [FlashAttention](https://arxiv.org/abs/2205.14135)
- [Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401)
- [Switch Transformers](https://arxiv.org/abs/2101.03961)
- [InstructGPT and human-feedback training](https://arxiv.org/abs/2203.02155)
- [Direct Preference Optimization](https://arxiv.org/abs/2305.18290)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/docs/getting-started/intro)