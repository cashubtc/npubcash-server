import { createHmac } from "crypto";

export function generateTOTP(key: Buffer, timeStep = 30, digits = 6) {
  const timeCounter = Math.floor(Date.now() / 1000 / timeStep);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(timeCounter / 0x100000000), 0);
  buffer.writeUInt32BE(timeCounter % 0x100000000, 4);

  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;

  return code.toString().padStart(digits, "0");
}

export function getOtpSecret(targetHexKey: string) {
  const secret = "mysecretsecret";
  const data = secret + targetHexKey;
  return Buffer.from(data, "hex");
}
