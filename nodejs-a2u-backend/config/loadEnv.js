import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const loadEnv = () => {
  const backendEnvPath = path.resolve(__dirname, "..", ".env");
  const repoRootEnvPath = path.resolve(__dirname, "..", "..", ".env");

  if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath, override: false });
  }

  if (fs.existsSync(repoRootEnvPath)) {
    dotenv.config({ path: repoRootEnvPath, override: false });
  }
};

