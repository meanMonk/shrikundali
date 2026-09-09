# assetgen — fal.ai Image Asset Generator

Generates all premium visual assets (website, PDF, campaign) via fal.ai using the prompts defined in `docs/prd/ai-image-generation-prompts.md`.

## Setup

1. Copy `.env.example` to `.env` in project root and set your fal.ai API key:
   ```bash
   FAL_KEY=fal_xxxxxxxxxxxxxxxxxxxxxxxx
   ```

2. Install dependencies:
   ```bash
   pnpm install --filter assetgen
   ```

## Usage

```bash
# List all available assets
node packages/tools/assetgen/generate.mjs --list

# Dry run — preview prompts without API calls
node packages/tools/assetgen/generate.mjs --dry-run

# Generate specific assets by ID
FAL_KEY=fal_xxx node packages/tools/assetgen/generate.mjs --only A1,A2

# Generate all assets in a category
FAL_KEY=fal_xxx node packages/tools/assetgen/generate.mjs --category website

# Generate everything
FAL_KEY=fal_xxx node packages/tools/assetgen/generate.mjs
```

## Flags

| Flag | Description |
|------|-------------|
| `--only <ids>` | Comma-separated asset IDs (e.g. `A1,B2,C3`) |
| `--category <cat>` | `website`, `pdf`, or `campaign` |
| `--dry-run` | Print prompts without calling the API |
| `--list` | List all available asset IDs |
| `-h, --help` | Show help |

## Assets

| ID | Category | Name | Model |
|----|----------|------|-------|
| A1 | website | Hero section background / stylized report mockup | recraft-v3 |
| A2 | website | Kundli-chart motif — recurring visual anchor | recraft-v3 |
| A3 | website | Open Graph / social share image | recraft-v3 |
| B1 | pdf | Cover page (page 1) full-bleed background | recraft-v3 |
| B2 | pdf | Closing/last page full-bleed background | recraft-v3 |
| C1 | campaign | Pain-point / hook creative | flux-pro/v1.1-ultra |
| C2 | campaign | Outcome / aspiration creative | flux-pro/v1.1-ultra |
| C3 | campaign | Trust / authority creative | flux-pro/v1.1-ultra |
| C4 | campaign | Cultural/festive relevance creative | flux-pro/v1.1-ultra |
| C5 | campaign | Direct offer / discount creative | recraft-v3 |

## Output

Generated images are saved to `output/` with the naming convention `<id>-<name>.png`.

Each generation also writes a `<id>-<name>.json` log file containing the exact fal.ai request params (model, seed, style) for reproducibility.

## Structure

```
packages/tools/assetgen/
├── generate.mjs                    # Main CLI script
├── ai-image-generation-prompts.md  # Copy of prompts doc
├── .env.example                    # FAL_KEY placeholder
├── package.json
└── output/                         # Generated assets land here
```
