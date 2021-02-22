import { libC } from "@mr-test/libC";

export const libA = (s: string): number => {
  return s.length + 13 + 53 + 90 + libC();
};
