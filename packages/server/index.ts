import * as A from "@effect-ts/core/Array";
import * as NEA from "@effect-ts/core/NonEmptyArray";
import * as O from "@effect-ts/core/Option";
import * as T from "@effect-ts/core/Effect";
import { fromOption } from "@effect-ts/core/Effect";
import { literal, pipe } from "@effect-ts/core/Function";
import { render } from "ink";
import * as React from "react";
import { makeMatchers } from "ts-adt/MakeADT";
import { PackageJson } from "./core/PackageJson";
import { mkPackagesState } from "./core/packagesState";
import { initialize } from "./intialize";
import { PackageList } from "./ui/PackageList";

const [matchTag, matchTagP] = makeMatchers("_tag");

const renderApp = (
  apps: ReadonlyArray<{
    package: PackageJson;
    localDeps: ReadonlyArray<PackageJson>;
  }>,
  appState: ReturnType<typeof mkPackagesState>,
  rootApp: PackageJson
) =>
  T.effectAsync<unknown, never, number>((cb) => {
    const exit = () => cb(T.succeed(0));
    render(
      React.createElement(PackageList, {
        workspaces: apps,
        exit,
        packagesState: appState,
        rootApp,
      })
    );
  });

pipe(
  T.do,
  T.chain(() => initialize),
  T.bind("appPackageJson", (a) =>
    pipe(
      a.workspaces,
      A.findFirst((w) => w.package.name === a.app),
      fromOption,
      T.mapError(() => ({
        _tag: literal("InitialAppNotFound"),
        appName: a.app,
      }))
    )
  ),
  T.bind("reactApp", ({ workspaces, rootApp }) => {
    return renderApp(
      workspaces,
      mkPackagesState(workspaces, rootApp),
      rootApp.package
    );
  }),
  (e) =>
    T.run(
      e,
      matchTag({
        Failure: (err) => [
          pipe(
            err.cause,
            matchTagP(
              {
                Fail: (f) =>
                  pipe(
                    f.value,
                    matchTagP(
                      {
                        CircularDepFound: (c) => {
                          console.error("Circular dep found:");
                          console.error(printCircular(c.context));
                        },
                      },
                      () => {}
                    )
                  ),
              },
              () => {}
            )
          ),
        ],
        Success: () => {},
      })
    )
);

const printCircular = (deps: readonly PackageJson[]): string => {
  const depsWithoutRecursive = pipe(deps, A.takeLeft(deps.length - 1));
  return pipe(
    deps,
    A.reverse,
    NEA.fromArray,
    O.map(NEA.head),
    O.map((h) => ({ recursiveDep: h })),
    O.bind("rIndex", ({ recursiveDep }) =>
      pipe(
        depsWithoutRecursive,
        A.findIndex((d) => d.name === recursiveDep.name)
      )
    ),
    O.map(({ recursiveDep, rIndex }) => {
      const [before, after] = pipe(deps, A.splitAt(rIndex));

      const afterWithoutRecursive = pipe(after, A.takeLeft(after.length - 1));

      const beforeStrs = before.map((p) => `   ${p.name}`).join("\n    │\n");

      const afterStrs = afterWithoutRecursive
        .map(
          (p, i) =>
            `${
              i === 0
                ? "╭─ "
                : i === afterWithoutRecursive.length - 1
                ? "╰─ "
                : "│  "
            }${p.name}`
        )
        .join("\n│   │\n");

      return beforeStrs + "\n    │\n" + afterStrs;
    }),
    O.getOrElse(() => "")
  );
};
