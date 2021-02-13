import * as T from "@effect-ts/core/Effect";
import * as F from "@effect-ts/system/Fiber";
import { flow, identity, pipe, tuple } from "@effect-ts/core/Function";
import * as O from "@effect-ts/core/Option";
import { Fiber } from "@effect-ts/system/Fiber";
import { newAtom } from "frp-ts/lib/atom";
import { newCounterClock } from "frp-ts/lib/clock";
import { runCommand } from "./command";
import { PackageJson } from "./packageJson";
import { Lens, Prism, fromTraversable, Traversal } from "monocle-ts";
import { array } from "fp-ts/lib/Array";
import { fst } from "fp-ts/lib/ReadonlyTuple";
import * as A from "@effect-ts/core/Array";
import { snd } from "fp-ts/lib/Tuple";
import { SimpleConsoleEnv } from "./ConsoleEnv";
import * as chokidar from "chokidar";
import path from "path";

type AppState = "starting" | "started" | "watching" | "building" | "inactive";
type AppWithProcess = {
  app: AppWithDeps;
  ps: O.Option<Fiber<unknown, unknown>>;
  state: AppState;
};
export type AppWithDeps = {
  dir: string;
  package: PackageJson;
  localDeps: PackageJson[];
};

type PackagesState = {
  workspaces: Array<AppWithProcess>;
};

const workspacesL = Lens.fromProp<PackagesState>()("workspaces");

const appWithProcessT = fromTraversable(array)<AppWithProcess>();
const getAppPrism = (name: string): Prism<AppWithProcess, AppWithProcess> =>
  Prism.fromPredicate((app) => app.app.package.name === name);

const getAppTraversal = (
  name: string
): Traversal<PackagesState, AppWithProcess> =>
  workspacesL.composeTraversal(appWithProcessT).composePrism(getAppPrism(name));

const psL = (name: string) =>
  getAppTraversal(name).composeLens(Lens.fromProp<AppWithProcess>()("ps"));
const stateL = (name: string) =>
  getAppTraversal(name).composeLens(Lens.fromProp<AppWithProcess>()("state"));

export const mkPackagesState = (workspaces: Array<AppWithDeps>) => {
  const atom = newAtom({ clock: newCounterClock() })<PackagesState>({
    workspaces: workspaces.map((app) => ({
      app,
      ps: O.none,
      state: "inactive",
    })),
  });

  const findPackage = (p: PackageJson) =>
    pipe(
      atom.get().workspaces,
      A.findFirst((w) => w.app.package.name === p.name)
    );

  const killApp = (p: PackageJson) => {
    return pipe(
      findPackage(p),
      O.chain((a) => a.ps),
      O.fold(() => T.succeed(0), F.interrupt),
      T.chain(() =>
        T.effectTotal(() => {
          atom.modify(psL(p.name).modify(() => O.none));
        })
      )
    );
  };

  const runCommandInApp = (
    p: PackageJson,
    command: string,
    onComplete: T.UIO<unknown>
  ) => {
    return pipe(
      runCommand(p)(command),
      T.chain(() => onComplete),
      T.fork,
      T.chain((f) =>
        T.effectTotal(() => {
          atom.modify(psL(p.name).modify(() => O.some(f)));
        })
      ),
      T.provide(SimpleConsoleEnv)
    );
  };

  const startApp = (p: PackageJson) => {
    // start the app...
    return pipe(
      T.do,
      T.bind("pkg", () => T.fromOption(findPackage(p))),
      T.bind("app", () =>
        pipe(
          runCommandInApp(p, "start", T.none),
          T.tap(() =>
            T.effectTotal(() => {
              atom.modify(stateL(p.name).modify(() => "started"));
            })
          )
        )
      ),
      T.bind("children", ({ pkg }) => {
        return pipe(
          findDeps(pkg.app),
          T.chain(
            T.foreach((d) => {
              const src = d.package.src ?? "src";
              const watchDir = path.join(__dirname, "..", "..", d.dir, src); // todo: remove ../..
              return pipe(
                T.effectTotal(() => {
                  const watcher = chokidar.watch(watchDir);
                  watcher.on("change", (path) => {
                    pipe(
                      T.effectTotal(() => {
                        atom.modify(
                          stateL(d.package.name).modify(() => "building")
                        );
                      }),
                      T.chain(() =>
                        runCommandInApp(
                          d.package,
                          "build",
                          T.effectTotal(() => {
                            atom.modify(
                              stateL(d.package.name).modify(() => "watching")
                            );
                          })
                        )
                      ),
                      T.run
                    );
                  });
                }),
                T.chain(() =>
                  T.effectTotal(() => {
                    atom.modify(
                      stateL(d.package.name).modify(() => "watching")
                    );
                  })
                )
              );
            })
          )
        );
      })
    );

    // then start watch processes on every dependency
  };

  const findDeps = (p: AppWithDeps): T.IO<unknown, Array<AppWithDeps>> => {
    return pipe(
      p.localDeps,
      T.foreach((p) => pipe(p, findPackage, T.fromOption)),
      T.map(A.map((a) => a.app)),
      T.chain((deps) =>
        pipe(
          deps,
          T.foreach(findDeps),
          T.map((moreDeps) =>
            pipe(moreDeps, A.chain(identity), (ds) => [...deps, ...ds])
          )
        )
      )
    );
  };

  return {
    atom,
    killApp,
    runCommandInApp,
    startApp,
  };
};
