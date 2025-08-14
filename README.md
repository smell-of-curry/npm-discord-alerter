# npm → Discord (Template)

Monitor multiple npm packages and tags and post updates to a Discord channel via webhook. Use this as a template repo; set your variables/secrets and it will notify automatically.

## Quick start

1. Use this repository as a template.
   - Click "Use this template" → "Create a new repository".

2. Set repository secret for Discord.
   - Settings → Secrets and variables → Actions → New repository secret
   - Name: `DISCORD_WEBHOOK_URL`
   - Value: your Discord webhook URL

3. Set repository variable for packages to monitor.
   - Settings → Secrets and variables → Actions → Variables → New variable
   - Name: `PACKAGES_TO_MONITOR`
   - Value: JSON object mapping `packageName` → `tag`
     ```json
     {
       "pokebedrock-showdown": "latest",
       "@minecraft/server": "beta"
     }
     ```
   - Supported tags: anything resolvable on the npm registry (e.g., `latest`, `beta`, custom dist-tags).

4. Enable workflow runs.
   - The workflow runs every 15 minutes by default.
   - You can also run it manually: Actions → `npm → Discord` → Run workflow.

## How it works

- Workflow file: `.github/workflows/alerter.yml`.
- For each `package@tag` in `PACKAGES_TO_MONITOR`, the workflow fetches the resolved version from the npm registry and compares it to the last seen version stored in `.state/`.
- On change, it sends a Discord embed and updates the corresponding `.state/*.txt` file, committing it back to the repository.

## Requirements/notes

- You must provide `DISCORD_WEBHOOK_URL` as a secret and `PACKAGES_TO_MONITOR` as a repository variable.
- The workflow needs permission to push `.state/` updates. This is already configured via `permissions: contents: write`.
- Scoped packages (e.g., `@scope/name`) are fully supported.
- The default schedule is `*/15 * * * *`. Adjust it in `.github/workflows/alerter.yml` if needed.

## Example Discord message

- Title: `📦 <package> (<tag>) updated`
- Description: `New version: <version>` and a handy `npm i <package>@<version>` snippet
- Link: npm package page

## TODO
1. Make discord message configurable
2. Make schedule configurable
3. Add testing
