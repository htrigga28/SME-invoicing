import { embeddedPostgresPlatform } from "./postgres-test-helper";

describe("embedded Postgres platform package names", () => {
  it.each([
    ["darwin", "darwin"],
    ["linux", "linux"],
    ["win32", "windows"]
  ])("maps %s to %s", (platform, expected) => {
    expect(embeddedPostgresPlatform(platform)).toBe(expected);
  });
});
