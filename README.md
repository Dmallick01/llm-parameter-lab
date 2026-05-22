# LLM Parameter Lab

Interactive educational dashboard for LLM systems — KV cache, quantization, sampling, RLHF, RAG, and scaling laws. Zero backend; runs entirely in the browser.

**Live demo:** Enable GitHub Pages (see below) or open `llm-lab.html` locally.

## Portals

| File | Contents |
|------|----------|
| `llm-lab.html` | KV cache, quantization, logit decoders |
| `enhanced-toolkit.html` | RLHF alignment, RAG budget, Chinchilla scaling |

## Quick start

```bash
open llm-lab.html
# or
python3 -m http.server 8080
# → http://localhost:8080/llm-lab.html
```

## GitHub Pages

1. Push repo to GitHub
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. Demo URL: `https://<username>.github.io/llm-parameter-lab/llm-lab.html`

## Widgets

1. **KV Cache** — $\text{RAM} = 2LHd_h n_{\text{ctx}} \times \text{bytes}$
2. **Quantization** — $\hat{w}_i = s \cdot (\text{clamp}(\text{round}(w_i/s)+z, 0, 2^b-1)-z)$
3. **Sampling** — $P_T(x_i) = \exp(l_i/T) / \sum_j \exp(l_j/T)$
4. **RLHF** — $J(\theta) = \mathbb{E}[r] - \beta \cdot \text{KL}[\pi_\theta \| \pi_{\text{ref}}]$
5. **RAG** — context budget vs. retrieval latency
6. **Chinchilla** — $L(N,D) = A/N^\alpha + B/D^\beta + L_\infty$

## Tech stack

Vanilla JS · HTML5 Canvas · CSS variables · no dependencies

## License

MIT
