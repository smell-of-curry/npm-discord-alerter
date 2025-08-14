import path from "path";
import fs from "fs";
import { NpmRegistryPackageResponse, NpmRegistryPackageVersion } from "./types";
import {
  DEFAULT_DESCRIPTION_TEMPLATE,
  DEFAULT_TITLE_TEMPLATE,
  DEFAULT_URL_TEMPLATE,
  webhookUrl,
} from ".";
import npmUser from "npm-user";
import axios from "axios";

/**
 * Convert a package name and tag to a state file name.
 * Example:
 * "pokebedrock-showdown@latest" -> ".state/pokebedrock-showdown__latest.txt"
 */
export function toStateFileName(pkg: string, tag: string): string {
  const stateDir = path.resolve(".state");
  fs.mkdirSync(stateDir, { recursive: true });
  const safePkg = pkg.replace(/@/g, "at-").replace(/\//g, "__");
  return path.join(stateDir, `${safePkg}__${tag}.txt`);
}

/**
 * Resolve the version of a package and tag from the npm registry.
 * Example:
 * "pokebedrock-showdown@latest" -> "1.0.0"
 */
export async function resolveVersion(
  response: NpmRegistryPackageResponse,
  tag: string
): Promise<string | null> {
  const distTags = (response && response["dist-tags"]) || {};
  if (distTags[tag]) return String(distTags[tag]);
  const versions = (response && response.versions) || {};
  if (versions[tag]?.version) return String(versions[tag].version);
  return null;
}

/**
 * Render a simple template by replacing {placeholders} with values from data.
 */
export function renderTemplate(
  template: string,
  data: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in data ? data[key] : `{${key}}`
  );
}

/**
 * Send a Discord message with the package name, tag, and version.
 * Example:
 * "pokebedrock-showdown@latest" -> "1.0.0"
 */
export async function sendDiscord(
  packageName: string,
  tag: string,
  version: NpmRegistryPackageVersion
) {
  const titleTemplateEnv = process.env.DISCORD_TITLE_TEMPLATE || "";
  const descriptionTemplateEnv = process.env.DISCORD_DESCRIPTION_TEMPLATE || "";
  const urlTemplateEnv = process.env.DISCORD_URL_TEMPLATE || "";

  const templateData = { package: packageName, tag, version: version.version };
  const title = renderTemplate(
    titleTemplateEnv || DEFAULT_TITLE_TEMPLATE,
    templateData
  );
  const description = renderTemplate(
    descriptionTemplateEnv || DEFAULT_DESCRIPTION_TEMPLATE,
    templateData
  );
  const url = renderTemplate(
    urlTemplateEnv || DEFAULT_URL_TEMPLATE,
    templateData
  );

  const npmUserName = version._npmUser?.name;
  const npmUserData = npmUserName ? await npmUser(npmUserName) : null;

  let authorIconUrl = npmUserData?.avatar;
  if (!authorIconUrl && npmUserData?.github) {
    authorIconUrl = `https://avatars.githubusercontent.com/u/${npmUserName}?v=4`;
  } else if (!authorIconUrl) {
    authorIconUrl =
      "https://raw.githubusercontent.com/smell-of-curry/npm-discord-alerter/refs/heads/main/images/npm-logo.png";
  }

  const payload = {
    embeds: [
      {
        author: {
          name: npmUserName || "Unknown",
          icon_url: authorIconUrl,
        },
        title,
        description,
        url,
        color: 0xed1c24, // npm red color
      },
    ],
  };

  await axios.post(webhookUrl, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
}
