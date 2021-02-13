import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core/Function";
import * as gradient from "gradient-string";

export interface ConsoleEnv {
  console: {
    log: (context: string) => (msg: string) => void;
    error: (context: string) => (msg: string) => void;
  };
}

const Colors = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  Underscore: "\x1b[4m",
  Blink: "\x1b[5m",
  Reverse: "\x1b[7m",
  Hidden: "\x1b[8m",

  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",

  BgBlack: "\x1b[40m",
  BgRed: "\x1b[41m",
  BgGreen: "\x1b[42m",
  BgYellow: "\x1b[43m",
  BgBlue: "\x1b[44m",
  BgMagenta: "\x1b[45m",
  BgCyan: "\x1b[46m",
  BgWhite: "\x1b[47m",
};

const hash = function (str: string) {
  var hash = 0,
    i,
    chr,
    len;
  if (str.length == 0) return hash;
  for (i = 0, len = str.length; i < len; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export const toGradient = (str: string) => {
  var number = Math.abs(hash(str));
  return gradients[Math.floor(number % gradients.length)];
};

const gradients = [
  "fruit",
  "atlas",
  "vice",
  "morning",
  "instagram",
  "mind",
  "teen",
  "retro",
  "summer",
] as const;

export const SimpleConsoleEnv: ConsoleEnv = {
  console: {
    log: (c) => (m) => {
      console.log(gradient[toGradient(c)](c), m.trim());
    },
    error: (c) => (m) => {
      console.error(c, "", m.trim());
    },
  },
};

export const Console = {
  log: (context: string) => (msg: string) =>
    pipe(
      T.environment<ConsoleEnv>(),
      T.chain(({ console }) =>
        T.effectTotal(() => {
          console.log(context)(msg);
        })
      )
    ),
  error: (context: string) => (msg: string) =>
    pipe(
      T.environment<ConsoleEnv>(),
      T.chain(({ console }) =>
        T.effectTotal(() => {
          console.error(context)(msg);
        })
      )
    ),
};
