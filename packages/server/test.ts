import { literal, pipe } from "@effect-ts/core/Function";
import { PackageJson } from "./packageJson";
import * as O from "@effect-ts/core/Option";
import * as A from "@effect-ts/core/Array";
import * as R from "@effect-ts/core/Record";
import * as T from "@effect-ts/core/Effect";
import { PS } from "./ps";

const wait = <T>(timeout: number, t: T) =>
  T.effectAsync<unknown, never, T>((cb) => {
    setTimeout(() => {
      cb(T.succeed(t));
    }, timeout);
  });

// pipe(
//   wait(1000, 5),
//   T.chain(() => wait(1000, 5)),
//   (e) =>
//     T.run(e, () => {
//       const now = new Date();
//       console.log("took:", now.getTime() - then.getTime(), "ms");
//     })
// );

const then = new Date();
console.log("starting");
pipe(
  T.do,
  T.bind("a", () => T.fork(wait("a", 1000, 5))),
  T.bind("b", () => T.fork(wait("b", 1000, 5))),
  (e) =>
    T.run(e, (result) => {
      const now = new Date();
      console.log("took:", now.getTime() - then.getTime(), "ms");
    })
);
