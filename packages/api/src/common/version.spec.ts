import { describe, it, expect } from "vitest";
import { VERSION, API_VERSION, RELAY_VERSION } from "./version";

describe("Version", () => {
  it("should have major, minor, and patch numbers", () => {
    expect(typeof VERSION.major).toBe("number");
    expect(typeof VERSION.minor).toBe("number");
    expect(typeof VERSION.patch).toBe("number");
  });

  it("should have full version as semver string", () => {
    expect(VERSION.full).toBe(
      `${VERSION.major}.${VERSION.minor}.${VERSION.patch}`,
    );
    expect(RELAY_VERSION).toBe(VERSION.full);
  });

  it("should have api version as major version string", () => {
    expect(VERSION.api).toBe(`v${VERSION.major}`);
    expect(API_VERSION).toBe(VERSION.major.toString());
  });

  it("should currently be version 0.1.0", () => {
    expect(VERSION.major).toBe(0);
    expect(VERSION.minor).toBe(1);
    expect(VERSION.patch).toBe(0);
    expect(RELAY_VERSION).toBe("0.1.0");
  });
});
