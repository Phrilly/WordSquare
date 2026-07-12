# AI Agent Instructions for WordSquare

## Purpose
This repository is a browser-based Word Square game built with plain PHP, JavaScript, CSS, and a MySQL-backed dictionary. The app serves a daily challenge with multiple variants (`bomb`, `scrabble`, and `lookahead`) based on server-side day cycling in `index.php`.

## What an AI should know
- `index.php` is the app entry point. It calculates the daily mode and exposes `window.GAME_CONFIG` for frontend logic.
- `validate.php` handles JSON POST actions, scores grids against the `dictionary` table, and uses prepared PDO queries.
- There is no modern build system in this repo; changes are typically validated by running the app in a local PHP server and checking browser behavior.
- `GEMINI.md` contains repository-specific architecture and code quality expectations. Read it before making changes.

## Key files and directories
- `index.php` — main HTML/PHP app shell, asset versioning, and daily variant selection.
- `validate.php` — backend validation, scoring, dictionary lookup, and DB connectivity.
- `audit.php` — game log / audit page.
- `css/` — stylesheets for layout, board, bomb mode, and responsive design.
- `js/` — gameplay logic, AI, rendering, and event handling.

## Development guidance
- Preserve existing security patterns in PHP: `declare(strict_types=1)`, input sanitization, prepared statements, and safe JSON handling.
- When editing Javascript, respect the daily mode logic driven by `window.GAME_CONFIG` and the event-based hooks in the frontend.
- Do not assume the repository uses a JS framework or build tool. Keep changes compatible with the existing plain HTML/CSS/JS architecture.

## When in doubt
- Prefer full, drop-in ready replacements over partial snippets or scaffolded fragments.
- Use `GEMINI.md` as the canonical style and security reference.
- If a change touches database access, preserve the PDO-based query style and avoid direct SQL string interpolation.
