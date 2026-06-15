import { SeederEnvironment } from "../core/types";

/**
 * چک می‌کنه آیا seeder باید در محیط فعلی اجرا بشه
 */
export function matchesEnvironment(
  seederEnv: SeederEnvironment | SeederEnvironment[] | undefined,
  currentEnv: string,
): boolean {
  if (!seederEnv || seederEnv === "*") return true;

  const envs = Array.isArray(seederEnv) ? seederEnv : [seederEnv];
  return envs.some((e) => e === "*" || e === currentEnv);
}
