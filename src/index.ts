import axios from "axios";
import fs from "fs";
import { resolveVersion, sendDiscord } from "./utils";
import type { NpmRegistryPackageResponse, PackagesToMonitor } from "./types";

export const webhookUrl = process.env.DISCORD_WEBHOOK_URL || "";
if (!webhookUrl) {
  console.error("Missing DISCORD_WEBHOOK_URL");
  process.exit(1);
}

export const packagesEnv = process.env.PACKAGES_TO_MONITOR || "";
if (!packagesEnv) {
  console.error("Missing PACKAGES_TO_MONITOR");
  process.exit(1);
}

let packagesToMonitor: PackagesToMonitor;
try {
  packagesToMonitor = JSON.parse(packagesEnv);
} catch {
  console.error("PACKAGES_TO_MONITOR is not valid JSON");
  process.exit(1);
}

/**
 * Main function to monitor the packages and send Discord messages.
 */
async function main() {
  // Load previous state if provided
  const statePath = process.env.STATE_PATH || "state.json";
  let previousState: Record<string, string> = {};
  if (fs.existsSync(statePath)) {
    try {
      previousState = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch {
      console.warn(`Failed to parse existing state at ${statePath}; starting fresh`);
      previousState = {};
    }
  }

  const nextState: Record<string, string> = { ...previousState };
  let hadChanges = false;
  for (const [pkg, tag] of Object.entries(packagesToMonitor)) {
    try {
      const encodedPackageId = encodeURIComponent(pkg);
      const url = `https://registry.npmjs.org/${encodedPackageId}`;
      const { data } = await axios.get<NpmRegistryPackageResponse>(url, {
        timeout: 15000,
      });
      const version = await resolveVersion(data, tag);
      if (!version) {
        console.warn(`Could not resolve ${pkg}@${tag}`);
        continue;
      }
      const key = `${pkg}@${tag}`;
      const last = previousState[key] || "none";
      if (last !== version) {
        await sendDiscord(pkg, tag, data.versions[version]);
        console.log(`Notified for ${pkg}@${tag} -> ${version}`);
        hadChanges = true;
      } else {
        console.log(`No change for ${pkg}@${tag} (still ${version})`);
      }
      nextState[key] = version;
    } catch (err) {
      console.error(`Error handling ${pkg}@${tag}:`, err);
    }
  }
  if (!hadChanges) {
    console.log("No updates detected.");
  }
  // Emit the updated state to STDOUT so the workflow can capture and archive it
  process.stdout.write(JSON.stringify(nextState, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
