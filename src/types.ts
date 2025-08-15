/**
 * The packages to monitor and the tags to monitor them for.
 * Example:
 * {
 *   "pokebedrock-showdown": "latest",
 *   "@minecraft/server": "beta"
 * }
 */
export type PackagesToMonitor = Record<string, string>;

export interface NpmRegistryPackageVersion {
  name: string;
  version: string;
  author?: {
    url?: string;
    name?: string;
    email?: string;
  };
  license?: string;
  maintainers?: {
    name: string;
    email: string;
  }[];
  contributors?: {
    url?: string;
    name?: string;
    email?: string;
  }[];
  homepage?: string;
  bugs?: {
    url?: string;
  };
  bin?: Record<string, string>;
  dist?: {
    shasum?: string;
    tarball?: string;
    fileCount?: number;
    integrity?: string;
    signatures?: {
      sig?: string;
      keyid?: string;
    }[];
    unpackedSize?: number;
  };
  main?: string;
  types?: string;
  engines?: {
    node?: string;
  };
  gitHead?: string;
  scripts?: Record<string, string>;
  _npmUser?: {
    name: string;
    email: string;
  };
  repository?: {
    url: string;
    type: string;
  };
  _npmVersion: string;
  description: string;
  directories?: Record<string, string>;
  _nodeVersion: string;
  dependencies?: Record<string, string>;
  _hasShrinkwrap?: boolean;
  devDependencies?: Record<string, string>;
  secretDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  _npmOperationalInternal?: {
    tmp?: string;
    host?: string;
  };
}

/**
 * The response from the npm registry for a package.
 * from {@link https://registry.npmjs.org/<package-name>}
 */
export interface NpmRegistryPackageResponse {
  _id: string;
  _rev: string;
  name: string;
  "dist-tags": Record<string, string>;
  versions: Record<string, NpmRegistryPackageVersion>;
  maintainers: { name: string; email: string }[];
  time: {
    modified: string;
    created: string;
  };
}
