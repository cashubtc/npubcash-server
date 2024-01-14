export function checkEnvVars(vars: string[]) {
  const missing: string[] = [];
  for (let i = 0; i < vars.length; i++) {
    if (!process.env[vars[i]]) {
      missing.push(vars[i]);
    }
  }
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(",")}`);
  }
}
