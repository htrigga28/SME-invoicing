import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import { loadRootEnv } from "./load-root-env";

jest.mock("dotenv", () => ({ config: jest.fn() }));

describe("loadRootEnv", () => {
  it("loads the repository root file and preserves process precedence", () => {
    const config = dotenv.config as jest.Mock;
    config.mockReturnValue({ parsed: { DATABASE_URL: "from-file" } });

    loadRootEnv();

    expect(config).toHaveBeenLastCalledWith({
      path: path.resolve(__dirname, "../../../../.env"),
      override: false
    });
  });

  it("resolves a stable root path from source or compiled config directories", () => {
    const root = path.resolve(__dirname, "../../../../.env");
    expect(path.basename(root)).toBe(".env");
    expect(fs.existsSync(path.dirname(root))).toBe(true);
  });
});
