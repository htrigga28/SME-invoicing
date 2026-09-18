import path from "node:path";
import dotenv from "dotenv";

/** Load the repository root .env without replacing explicit process values. */
export function loadRootEnv() {
  return dotenv.config({
    path: path.resolve(__dirname, "../../../../.env"),
    override: false
  });
}

loadRootEnv();
