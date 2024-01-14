import crypto from "crypto";
import { checkEnvVars } from "./general";

const algorithm = "aes-256-ecb";

export function encryptString(s: string) {
  checkEnvVars(["ENCRYPTION_SECRET"]);
  const cipher = crypto.createCipheriv(
    algorithm,
    process.env["ENCRYPTION_SECRET"]!,
    null,
  );
  return cipher.update(s, "utf8", "hex") + cipher.final("hex");
}

export function decryptString(s: string) {
  checkEnvVars(["ENCRYPTION_SECRET"]);
  const decipher = crypto.createDecipheriv(
    algorithm,
    process.env["ENCRYPTION_SECRET"]!,
    null,
  );
  return decipher.update(s, "hex", "utf8") + decipher.final("utf8");
}
