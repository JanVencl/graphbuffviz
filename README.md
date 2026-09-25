# graphbuffviz

A zero-build, browser-based repository visualization tool. Paste a public GitHub URL and graphbuffviz maps its files into an interactive network graph. Select a node to inspect its inferred blast radius, direct connections, and impact score.

## Run locally

Open `index.html` directly in a browser, or serve the directory with any static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Notes

- Public GitHub repositories are read through GitHub's public Git Trees API; no credentials are stored or required.
- The graph intentionally keeps the visualization lightweight and limits the initial tree to 70 files.
- For non-GitHub URLs or unavailable repositories, the UI presents a representative topology preview so the interaction remains demonstrable.
- Dependency edges are currently inferred from repository ordering as a resilient preview layer; a future analyzer can replace `makeLinks()` with language-specific import parsing.
