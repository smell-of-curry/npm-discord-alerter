import axios from "axios";
import fs from "fs";
import { resolveVersion, sendDiscord, toStateFileName } from "./utils";
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
      const stateFile = toStateFileName(pkg, tag);
      const last = fs.existsSync(stateFile)
        ? fs.readFileSync(stateFile, "utf8")
        : "none";
      if (last !== version) {
        fs.writeFileSync(stateFile, version);
        await sendDiscord(pkg, tag, data.versions[version]);
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
    console.log("No updates detected.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
