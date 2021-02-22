import * as T from "@effect-ts/core/Effect";
import * as F from "@effect-ts/system/Fiber";
import * as A from "@effect-ts/core/Array";
import { literal, pipe } from "@effect-ts/core/Function";
import { run, runMain } from "@effect-ts/node/Runtime";
import { runCommand } from "./command";
import { initialize } from "./intialize";

import * as React from "react";

import { render, Text } from "ink";
import { PackageJson } from "./packageJson";
import { PackageList } from "./PackageList";
import { fromOption } from "@effect-ts/core/Effect";
import { SimpleConsoleEnv } from "./ConsoleEnv";
import { mkPackagesState } from "./packagesState";
import { AppWithDeps } from "./AppWithDeps";
import { makeMatchers } from "ts-adt/MakeADT";

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

// run(t, (result) => {
//   if (result._tag === "Success") {
//     console.log("rendering");
//     render(
//       React.createElement(PackageList, {
//         workspaces: result.value.workspaces,
//       })
//     );
//   } else {
//     console.log("not rendering...");
//   }
// })

pipe(
  // AltScreen.enter,
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
  T.bind("____", ({ appPackageJson }) =>
    T.effectTotal(() => {
      // console.log("starting ", appPackageJson.package.name);
    })
  ),
  T.bind("reactApp", ({ workspaces, rootApp }) => {
    return renderApp(
      workspaces,
      mkPackagesState(workspaces, rootApp as AppWithDeps),
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
                          console.error(
                            "Circular dep found: ",
                            c.context
                              .map((p) => `${p.name}:${p.version}`)
                              .join(" -> ")
                          );
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
