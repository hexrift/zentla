// Central version information for Zentla
// Auto-updated by release-please - do not edit manually

export const VERSION = {
  major: 5, // x-release-please-major
  minor: 10, // x-release-please-minor
  patch: 0, // x-release-please-patch
  get full(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  },
  get api(): string {
    return `v${this.major}`;
  },
};

// API version for routing (e.g., /api/v1/)
export const API_VERSION = VERSION.major.toString();

// Full semver version
export const ZENTLA_VERSION = VERSION.full;
