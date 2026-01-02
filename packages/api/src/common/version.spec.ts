import { describe, it, expect } from "vitest";
import { VERSION, API_VERSION, ZENTLA_VERSION } from "./version";

describe("Version", () => {
  it("should have major, minor, and patch numbers", () => {
    expect(typeof VERSION.major).toBe("number");
    expect(typeof VERSION.minor).toBe("number");
    expect(typeof VERSION.patch).toBe("number");
    expect(VERSION.major).toBeGreaterThanOrEqual(0);
    expect(VERSION.minor).toBeGreaterThanOrEqual(0);
    expect(VERSION.patch).toBeGreaterThanOrEqual(0);
  });

  it("should have full version as semver string", () => {
    expect(VERSION.full).toBe(
      `${VERSION.major}.${VERSION.minor}.${VERSION.patch}`,
    );
    expect(ZENTLA_VERSION).toBe(VERSION.full);
    expect(ZENTLA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("should have api version as major version string", () => {
    expect(VERSION.api).toBe(`v${VERSION.major}`);
    expect(API_VERSION).toBe(VERSION.major.toString());
  });

  it("should match root package.json version", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const packageJsonPath = path.join(__dirname, "../../../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    expect(ZENTLA_VERSION).toBe(packageJson.version);
  });
});
