// Central version information for Relay
// Keep in sync with packages/api/src/common/version.ts

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

export const RELAY_VERSION = VERSION.full;
export const API_VERSION = VERSION.api;
