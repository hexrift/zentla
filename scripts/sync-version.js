#!/usr/bin/env node

/**
 * Syncs version from root package.json to all version.ts files.
 * Run this script after updating the version in package.json.
 *
 * Usage: node scripts/sync-version.js
 */

const fs = require("fs");
const path = require("path");

const ROOT_PACKAGE_JSON = path.join(__dirname, "..", "package.json");

const VERSION_FILES = [
  "packages/api/src/common/version.ts",
  "packages/web/src/version.ts",
];

function parseVersion(versionString) {
  const [major, minor, patch] = versionString.split(".").map(Number);
  return { major, minor, patch };
}

function generateVersionFile(version, isApi = false) {
  const comment = isApi
    ? "// Central version information for the Zentla API\n// Auto-generated from root package.json - do not edit manually"
    : "// Central version information for Zentla\n// Auto-generated from root package.json - do not edit manually";

  return `${comment}

export const VERSION = {
  major: ${version.major},
  minor: ${version.minor},
  patch: ${version.patch},
  get full(): string {
    return \`\${this.major}.\${this.minor}.\${this.patch}\`;
  },
  get api(): string {
    return \`v\${this.major}\`;
  },
};

// API version for routing (e.g., /api/v1/)
export const API_VERSION = VERSION.major.toString();

// Full semver version
export const ZENTLA_VERSION = VERSION.full;
`;
}

function main() {
  // Read root package.json
  const packageJson = JSON.parse(fs.readFileSync(ROOT_PACKAGE_JSON, "utf8"));
  const version = parseVersion(packageJson.version);

  console.log(`Syncing version ${packageJson.version} to all version files...`);

  for (const file of VERSION_FILES) {
    const filePath = path.join(__dirname, "..", file);
    const isApi = file.includes("api");
    const content = generateVersionFile(version, isApi);

    fs.writeFileSync(filePath, content);
    console.log(`  Updated ${file}`);
  }

  console.log("Done!");
}

main();
