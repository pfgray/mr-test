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
import * as E from "@effect-ts/core/Either";
import { snd } from "fp-ts/lib/Tuple";
import { SimpleConsoleEnv } from "./ConsoleEnv";
import * as chokidar from "chokidar";
import path from "path";
import { AppWithDeps, findDeps, findPackage } from "./AppWithDeps";
import { Watch } from "./Watch";

export type AppState =
  | "starting"
  | "started"
  | "watching"
  | "building"
  | "inactive";
export type AppWithProcess = {
  app: AppWithDeps;
  build: O.Option<Fiber<unknown, unknown>>;
  watch: O.Option<Fiber<unknown, unknown>>;
  state: AppState;
};
export type PackagesState = {
  rootApp: AppWithDeps;
  workspaces: Array<AppWithProcess>;
  dependencies: Array<AppWithDeps>;
  killed: boolean;
};

const workspacesL = Lens.fromProp<PackagesState>()("workspaces");
export const killedL = Lens.fromProp<PackagesState>()("killed");

const appWithProcessT = fromTraversable(array)<AppWithProcess>();
const getAppPrism = (name: string): Prism<AppWithProcess, AppWithProcess> =>
  Prism.fromPredicate((app) => app.app.package.name === name);

const getFirst = <A, B>(t: Traversal<A, B>) => (a: A): O.Option<B> =>
  pipe(t.asFold().getAll(a), A.head);

const getAppTraversal = (
  name: string
): Traversal<PackagesState, AppWithProcess> =>
  workspacesL.composeTraversal(appWithProcessT).composePrism(getAppPrism(name));

const buildPsL = (name: string) =>
  getAppTraversal(name).composeLens(Lens.fromProp<AppWithProcess>()("build"));
const watchPsL = (name: string) =>
  getAppTraversal(name).composeLens(Lens.fromProp<AppWithProcess>()("watch"));
const stateL = (name: string) =>
  getAppTraversal(name).composeLens(Lens.fromProp<AppWithProcess>()("state"));

export const mkPackagesState = (
  workspaces: Array<AppWithDeps>,
  rootApp: AppWithDeps
) => {
  const dependencies = pipe(
    findDeps(workspaces, [])(rootApp),
    E.fold(() => [] as Array<AppWithDeps>, identity)
  );

  const atom = newAtom({ clock: newCounterClock() })<PackagesState>({
    dependencies,
    rootApp,
    killed: false,
    workspaces: workspaces.map((app) => ({
      app,
      build: O.none,
      watch: O.none,
      state: "inactive",
    })),
  });

  const killApp = (p: PackageJson) => {
    return pipe(
      atom.get(),
      getFirst(getAppTraversal(p.name)),
      O.fold(
        () => T.succeed(0),
        (a) =>
          pipe(
            [a.build, a.watch],
            T.foreachPar(O.fold(() => T.succeed(0 as unknown), F.interrupt))
          )
      ),
      T.chain(() =>
        T.effectTotal(() => {
          atom.modify(buildPsL(p.name).modify(() => O.none));
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
      T.chain(() =>
        T.effectTotal(() => {
          atom.modify(buildPsL(p.name).modify(() => O.none));
        })
      ),
      T.chain(() => onComplete),
      T.fork,
      T.chain((f) =>
        T.effectTotal(() => {
          atom.modify(buildPsL(p.name).modify(() => O.some(f)));
        })
      ),
      T.provide(SimpleConsoleEnv)
    );
  };

  const buildApp = (p: PackageJson) => {
    return pipe(
      T.effectTotal(() => {
        atom.modify(stateL(p.name).modify(() => "building"));
      }),
      T.chain(() =>
        runCommandInApp(
          p,
          "build",
          T.effectTotal(() => {
            atom.modify(stateL(p.name).modify(() => "watching"));
          })
        )
      )
    );
  };

  const startApp = (p: PackageJson) => {
    // start the app...
    return pipe(
      T.do,
      T.bind("pkg", () =>
        T.fromOption(findPackage(atom.get().workspaces.map((a) => a.app))(p))
      ),
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
          T.fromEither(() =>
            findDeps(
              atom.get().workspaces.map((a) => a.app),
              []
            )(pkg)
          ),
          T.chain(
            T.foreachPar((d) => {
              const src = d.package.src ?? "src";
              const watchDir = path.join(process.cwd(), d.dir, src);
              return pipe(
                Watch.dir(watchDir, () => buildApp(d.package)),
                T.fork,
                T.chain((f) =>
                  T.effectTotal(() => {
                    atom.modify((s) =>
                      watchPsL(d.package.name).modify(() => O.some(f))(
                        stateL(d.package.name).modify(() => "watching")(s)
                      )
                    );
                  })
                )
              );
            })
          )
        );
      })
    );
  };

  return {
    atom,
    killApp,
    runCommandInApp,
    startApp,
  };
};
