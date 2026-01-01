// Central version information for the Relay API
// Update these values with each release

export const VERSION = {
  major: 0,
  minor: 1,
  patch: 0,
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
export const RELAY_VERSION = VERSION.full;
