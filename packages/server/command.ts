import { literal, pipe } from "@effect-ts/core/Function";
import { PackageJson } from "./packageJson";
import * as O from "@effect-ts/core/Option";
import * as A from "@effect-ts/core/Array";
import * as R from "@effect-ts/core/Record";
import * as T from "@effect-ts/core/Effect";
import { PS } from "./ps";

export const runCommand = (p: PackageJson) => (command: string) =>
  pipe(
    p,
    getCommand(command),
    T.chain((cmd) => PS.spawn(p.name)("yarn")(["workspace", p.name, command]))
    // T.chain((cmd) => PS.exec("yarn workspace " + p.name + " " + command))
  );

const getCommand = (command: string) => (p: PackageJson) =>
  pipe(
    O.fromNullable(p.scripts),
    O.map(R.toArray),
    O.chain(A.findFirst(([s]) => s === command)),
    T.fromOption,
    T.mapError(() => ({
      tag: literal("CommandNotFound"),
      package: p,
      command,
    })),
    T.map(([, command]) => command)
  );
