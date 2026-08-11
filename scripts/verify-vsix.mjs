#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MAX_VSIX_BYTES = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const UNZIP_MAX_BUFFER_BYTES = 20 * 1024 * 1024;
const REQUIRED_PACKAGE_FILES = [
  "extension/license.txt",
  "extension/readme.md",
  "extension/third_party_notices.md",
];
const FORBIDDEN_PACKAGE_ENTRY =
  /(?:^|\/)(?:\.env(?:\.|$)|\.git(?:\/|$)|\.DS_Store$|node_modules\/|src\/|test\/)|(?:\.map|\.tsbuildinfo|\.vsix)$/i;

const extensionDirectories = process.argv.slice(2);
if (extensionDirectories.length === 0) {
  throw new Error("Pass at least one extension directory to verify.");
}

await Promise.all(
  extensionDirectories.map((extensionDirectory) =>
    verifyExtensionPackage(path.resolve(extensionDirectory)),
  ),
);

async function verifyExtensionPackage(extensionDirectory) {
  const sourceManifest = JSON.parse(
    await readFile(path.join(extensionDirectory, "package.json"), "utf8"),
  );
  const artifactName = `${requiredString(sourceManifest.name, "name")}-${requiredString(
    sourceManifest.version,
    "version",
  )}.vsix`;
  const artifactPath = path.join(extensionDirectory, artifactName);
  const artifactStats = await stat(artifactPath);

  if (artifactStats.size === 0 || artifactStats.size > MAX_VSIX_BYTES) {
    throw new Error(
      `${artifactName} must be between 1 byte and ${formatBytes(MAX_VSIX_BYTES)}; received ${formatBytes(artifactStats.size)}.`,
    );
  }

  const packageEntries = runUnzip(["-Z1", artifactPath]).split(/\r?\n/u).filter(Boolean);
  const unsafeEntry = packageEntries.find(isUnsafePackageEntry);
  if (unsafeEntry != null) {
    throw new Error(
      `${artifactName} contains unsafe archive entry ${JSON.stringify(unsafeEntry)}.`,
    );
  }

  const archiveMetadata = runUnzip(["-Z", "-l", artifactPath]);
  if (archiveMetadata.split(/\r?\n/u).some((line) => /^l[rwx-]{9}\s/u.test(line))) {
    throw new Error(`${artifactName} contains a symbolic link.`);
  }

  const archiveSummary = runUnzip(["-Z", "-t", artifactPath]);
  const uncompressedSizeMatch = archiveSummary.match(/(?:^|\s)(\d+) bytes uncompressed(?:,|$)/u);
  if (uncompressedSizeMatch == null) {
    throw new Error(`${artifactName} did not report an uncompressed archive size.`);
  }
  const uncompressedSize = Number(uncompressedSizeMatch[1]);
  if (!Number.isSafeInteger(uncompressedSize) || uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
    throw new Error(
      `${artifactName} must expand to at most ${formatBytes(MAX_UNCOMPRESSED_BYTES)}; received ${formatBytes(uncompressedSize)}.`,
    );
  }

  runUnzip(["-tq", artifactPath]);
  const normalizedEntries = new Set(packageEntries.map((entry) => entry.toLowerCase()));
  const packagedManifest = JSON.parse(runUnzip(["-p", artifactPath, "extension/package.json"]));

  for (const field of ["name", "version", "publisher"]) {
    if (packagedManifest[field] !== sourceManifest[field]) {
      throw new Error(
        `${artifactName} manifest field ${field} is ${String(packagedManifest[field])}, expected ${String(sourceManifest[field])}.`,
      );
    }
  }

  const extensionMain = `extension/${requiredString(packagedManifest.main, "main").replace(/^\.\//u, "")}`;
  const requiredEntries = [
    ...REQUIRED_PACKAGE_FILES,
    extensionMain,
    "extension/dist/webview/main.js",
  ];
  for (const requiredEntry of requiredEntries) {
    if (!normalizedEntries.has(requiredEntry.toLowerCase())) {
      throw new Error(`${artifactName} is missing required entry ${requiredEntry}.`);
    }
  }

  const forbiddenEntry = packageEntries.find((entry) => FORBIDDEN_PACKAGE_ENTRY.test(entry));
  if (forbiddenEntry != null) {
    throw new Error(`${artifactName} contains forbidden entry ${forbiddenEntry}.`);
  }

  const checksum = createHash("sha256")
    .update(await readFile(artifactPath))
    .digest("hex");
  await writeFile(`${artifactPath}.sha256`, `${checksum}  ${artifactName}\n`, "utf8");
  process.stdout.write(
    `Verified ${artifactName}: ${packageEntries.length} files, ${formatBytes(artifactStats.size)}, sha256 ${checksum}\n`,
  );
}

function requiredString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Extension package.json field ${field} must be a non-empty string.`);
  }

  return value;
}

function isUnsafePackageEntry(entry) {
  if (
    entry.includes("\\") ||
    entry.includes("\0") ||
    entry.startsWith("/") ||
    /^[A-Za-z]:/u.test(entry)
  ) {
    return true;
  }

  return entry.split("/").some((segment) => segment === "." || segment === "..");
}

function runUnzip(args) {
  try {
    return execFileSync("unzip", args, {
      encoding: "utf8",
      maxBuffer: UNZIP_MAX_BUFFER_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to inspect VSIX with unzip: ${detail}`, { cause: error });
  }
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
