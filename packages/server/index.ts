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
import { AltScreen } from "./AltScreen";
import { AppWithDeps } from "./AppWithDeps";

const renderApp = (
  apps: Array<{
    package: PackageJson;
    localDeps: Array<PackageJson>;
  }>,
  appState: ReturnType<typeof mkPackagesState>,
  rootApp: PackageJson
) =>
  T.effectAsync<unknown, unknown, number>((cb) => {
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
      T.mapError(() => ({ tag: literal("InitialAppNotFound"), appName: a.app }))
    )
  ),
  T.bind("____", ({ appPackageJson }) =>
    T.effectTotal(() => {
      // console.log("starting ", appPackageJson.package.name);
    })
  ),
  // T.bind("appStart", (a) =>
  //   pipe(runCommand(a.appPackageJson.package)("start"), T.fork)
  // ),
  T.bind("reactApp", ({ workspaces, rootApp }) => {
    const ws: Array<AppWithDeps> = workspaces as Array<AppWithDeps>;
    return renderApp(
      ws,
      mkPackagesState(ws, rootApp as AppWithDeps),
      rootApp.package
    );
  }),
  //T.tap(() => AltScreen.exit),
  //T.provide(SimpleConsoleEnv),
  // T.chain(fiber => fiber),
  (e) =>
    T.run(e, (result) => {
      // result._tag === "Success" && result.value;
      // console.log("finished", result);
    })
);
