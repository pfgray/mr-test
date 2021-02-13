import * as T from "@effect-ts/core/Effect";
import { literal, pipe } from "@effect-ts/core/Function";
import * as fs from "fs";
import glob from "glob";
import { exec, spawn, ExecException } from "child_process";
import { ConsoleEnv } from "./ConsoleEnv";

import kill from "tree-kill";

export const PS = {
  spawn: (context: string) => (command: string) => (args: string[]) =>
    pipe(
      T.environment<ConsoleEnv>(),
      T.tap(({ console }) =>
        T.effectTotal(() => {
          console.log(context)("running" + command + " " + args.join(" "));
        })
      ),
      T.chain(({ console }) =>
        T.effectAsyncInterrupt<unknown, number, 0>((cb) => {
          const child = spawn(command, args);

          console.log(context)("PID: " + child.pid);

          child.stdout.on("data", (data) => {
            console.log(context)(data.toString());
          });

          child.stderr.on("data", (data) => {
            console.error(context)(data.toString());
          });

          child.on("close", (code) => {
            if (code === 0) {
              cb(T.succeed(code));
            } else {
              cb(T.fail(code));
            }
          });
          return T.effectTotal(() => {
            kill(child.pid);
          });
        })
      )
    ),
  exec: (command: string) =>
    T.effectAsync<unknown, ExecException | string, string>((cb) => {
      exec(command, (err, stdout, stderr) => {
        if (err) {
          cb(T.fail(err));
        } else if (stderr) {
          cb(T.fail(stderr));
        } else {
          cb(T.succeed(stdout));
        }
      });
    }),
};
