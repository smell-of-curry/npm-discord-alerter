import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * The packages to monitor and the tags to monitor them for.
 * Example:
 * {
 *   "pokebedrock-showdown": "latest",
 *   "@minecraft/server": "beta"
 * }
 */
type PackagesToMonitor = Record<string, string>;

const webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
const packagesEnv = process.env.PACKAGES_TO_MONITOR || '';
const titleTemplateEnv = process.env.DISCORD_TITLE_TEMPLATE || '';
const descriptionTemplateEnv = process.env.DISCORD_DESCRIPTION_TEMPLATE || '';
const urlTemplateEnv = process.env.DISCORD_URL_TEMPLATE || '';

if (!webhookUrl) {
  console.error('Missing DISCORD_WEBHOOK_URL');
  process.exit(1);
}

if (!packagesEnv) {
  console.error('Missing PACKAGES_TO_MONITOR');
  process.exit(1);
}

let packagesToMonitor: PackagesToMonitor;
try {
  packagesToMonitor = JSON.parse(packagesEnv);
} catch {
  console.error('PACKAGES_TO_MONITOR is not valid JSON');
  process.exit(1);
}

const stateDir = path.resolve('.state');
fs.mkdirSync(stateDir, { recursive: true });

/**
 * Convert a package name and tag to a state file name.
 * Example:
 * "pokebedrock-showdown@latest" -> ".state/pokebedrock-showdown__latest.txt"
 */
function toStateFileName(pkg: string, tag: string): string {
  const safePkg = pkg.replace(/@/g, 'at-').replace(/\//g, '__');
  return path.join(stateDir, `${safePkg}__${tag}.txt`);
}

/**
 * Resolve the version of a package and tag from the npm registry.
 * Example:
 * "pokebedrock-showdown@latest" -> "1.0.0"
 */
async function resolveVersion(pkg: string, tag: string): Promise<string | null> {
  const encoded = encodeURIComponent(pkg);
  const url = `https://registry.npmjs.org/${encoded}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  const distTags = (data && data['dist-tags']) || {};
  if (distTags[tag]) return String(distTags[tag]);
  const versions = (data && data.versions) || {};
  if (versions[tag]?.version) return String(versions[tag].version);
  return null;
}

/**
 * Render a simple template by replacing {placeholders} with values from data.
 */
function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in data ? data[key] : `{${key}}`));
}

const DEFAULT_TITLE_TEMPLATE = '[{package}:{tag}] updated to {version}';
const DEFAULT_DESCRIPTION_TEMPLATE = '`npm i {package}@{version}`';
const DEFAULT_URL_TEMPLATE = 'https://www.npmjs.com/package/{package}';

/**
 * Send a Discord message with the package name, tag, and version.
 * Example:
 * "pokebedrock-showdown@latest" -> "1.0.0"
 */
async function sendDiscord(packageName: string, tag: string, version: string) {
  const templateData = { package: packageName, tag, version };
  const title = renderTemplate(titleTemplateEnv || DEFAULT_TITLE_TEMPLATE, templateData);
  const description = renderTemplate(descriptionTemplateEnv || DEFAULT_DESCRIPTION_TEMPLATE, templateData);
  const url = renderTemplate(urlTemplateEnv || DEFAULT_URL_TEMPLATE, templateData);

  const payload = {
    embeds: [
      {
        title,
        description,
        url,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  await axios.post(webhookUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });
}

/**
 * Main function to monitor the packages and send Discord messages.
 */
async function main() {
  let hadChanges = false;
  for (const [pkg, tag] of Object.entries(packagesToMonitor)) {
    try {
      const version = await resolveVersion(pkg, tag);
      if (!version) {
        console.warn(`Could not resolve ${pkg}@${tag}`);
        continue;
      }
      const stateFile = toStateFileName(pkg, tag);
      const last = fs.existsSync(stateFile)
        ? fs.readFileSync(stateFile, 'utf8')
        : 'none';
      if (last !== version) {
        fs.writeFileSync(stateFile, version);
        await sendDiscord(pkg, tag, version);
        console.log(`Notified for ${pkg}@${tag} -> ${version}`);
        hadChanges = true;
      } else {
        console.log(`No change for ${pkg}@${tag} (still ${version})`);
      }
    } catch (err) {
      console.error(`Error handling ${pkg}@${tag}:`, err);
    }
  }
  if (!hadChanges) {
    console.log('No updates detected.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


