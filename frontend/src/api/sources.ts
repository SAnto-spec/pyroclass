import type { PersistentThermalSource } from "../types/source";
import { mockSources } from "../mocks/sources";

export async function fetchSources(): Promise<PersistentThermalSource[]> {
  return mockSources;
}
