import path from "path";
import fs from "fs";
import npmUser from "npm-user";
import axios from "axios";
import type {
  NpmRegistryPackageResponse,
  NpmRegistryPackageVersion,
} from "./types";
import {
  DEFAULT_AVATAR_URL,
  DEFAULT_DESCRIPTION_TEMPLATE,
  DEFAULT_TITLE_TEMPLATE,
  DEFAULT_URL_TEMPLATE,
  DEFAULT_USERNAME,
} from "./config";
import { webhookUrl } from "./index";

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

type AvatarCacheEntry = { avatar: string | null; expiresAt: number };
type AvatarCache = Record<string, AvatarCacheEntry>;

const AVATAR_CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

/**
 * Get the path to the avatar cache file.
 */
function getAvatarCachePath(): string {
  const stateDir = path.resolve(".state");
  fs.mkdirSync(stateDir, { recursive: true });
  return path.join(stateDir, "npm-avatar-cache.json");
}

/**
 * Read the avatar cache file.
 * @returns
 */
function readAvatarCache(): AvatarCache {
  const cachePath = getAvatarCachePath();
  if (!fs.existsSync(cachePath)) return {};
  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw) as AvatarCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn(`Failed to read avatar cache: ${error}`);
    return {};
  }
}

/**
 * Write the avatar cache file.
 */
function writeAvatarCache(cache: AvatarCache): void {
  const cachePath = getAvatarCachePath();
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
  } catch (error) {
    console.warn(`Failed to write avatar cache: ${error}`);
  }
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
  return template.replace(
    /\{(\w+)\}/g,
    (_, key: string) => data[key] ?? `{${key}}`
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
  let authorIconUrl = DEFAULT_AVATAR_URL;
  if (npmUserName) {
    const now = Date.now();
    const cache = readAvatarCache();
    let cached = cache[npmUserName];

    if (cached && cached.avatar && cached.expiresAt > now)
      authorIconUrl = cached.avatar;
    else {
      let fetchedAvatar: string | null = null;
      try {
        const npmUserData = await npmUser(npmUserName);
        fetchedAvatar = npmUserData?.avatar || null;

        // Fallback to GitHub avatar when npm avatar is not available
        if (!fetchedAvatar && npmUserData?.github)
          fetchedAvatar = `https://github.com/${npmUserData.github}.png`;
      } catch (error) {
        console.warn(
          `Failed to fetch npm profile for ${npmUserName}; using cached/default avatar: ${error}`
        );
      }

      if (fetchedAvatar && fetchedAvatar !== cached?.avatar) {
        // Update/write the new avatar to the cache
        authorIconUrl = fetchedAvatar;
        cached = {
          avatar: fetchedAvatar,
          expiresAt: now + AVATAR_CACHE_TTL_MS,
        };
      } else if (cached?.avatar) {
        // Use stale cached avatar when fetch fails, or if the fetched avatar is the same as the cached avatar
        authorIconUrl = cached.avatar;
        cached.expiresAt = now + AVATAR_CACHE_TTL_MS;
      } else {
        // Write a one day (1/5 of the TTL) cache entry for the default avatar
        // so we don't keep hitting the API for a 429 error (for example).
        authorIconUrl = DEFAULT_AVATAR_URL;
        cached = {
          avatar: null,
          expiresAt: now + AVATAR_CACHE_TTL_MS / 5,
        };
      }

      writeAvatarCache(cache);
    }
  }

  const payload = {
    username: DEFAULT_USERNAME,
    avatar_url: DEFAULT_AVATAR_URL,
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
