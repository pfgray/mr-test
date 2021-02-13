import * as React from "react";
import { PackageJson } from "./packageJson";
import { Text, useInput, useApp, Box, Newline, Spacer } from "ink";
import { version } from "yargs";
import { pipe } from "@effect-ts/core/Function";
import * as A from "@effect-ts/core/Array";
import { mkPackagesState } from "./packagesState";
import Gradient from "ink-gradient";
import * as T from "@effect-ts/core/Effect";

import Divider from "ink-divider";
import { toGradient } from "./ConsoleEnv";

type PackageListProps = {
  workspaces: Array<{
    package: PackageJson;
    localDeps: Array<PackageJson>;
  }>;
  packagesState: ReturnType<typeof mkPackagesState>;
  exit: () => void;
};

const between = (min: number, max: number) => (n: number) =>
  Math.min(max, Math.max(n, min));

export const PackageList = (props: PackageListProps) => {
  const { packagesState: appStateA, workspaces } = props;

  const [packagesState, setPackagesState] = React.useState(
    appStateA.atom.get()
  );

  React.useEffect(() => {
    const subscription = appStateA.atom.subscribe({
      next: (a) => setPackagesState(appStateA.atom.get()),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [appStateA]);

  const [highlighted, setHighlighted] = React.useState(0);
  const app = useApp();

  const inRange = between(0, props.workspaces.length - 1);

  useInput((input, key) => {
    if (input === "q") {
      app.exit();
      props.exit();
    } else if (key.downArrow) {
      setHighlighted(inRange(highlighted + 1));
    } else if (key.upArrow) {
      setHighlighted(inRange(highlighted - 1));
    } else if (key.return) {
      // start watch on every dependency of highlighted package
      // appStateA.runCommandInApp(workspaces[highlighted].package, "start");
      pipe(appStateA.startApp(workspaces[highlighted].package), T.run);
    } else if (input === "k") {
      appStateA.killApp(workspaces[highlighted].package);
    }
  });

  return (
    <>
      <Divider width={60} />
      <Box flexDirection="column">
        {pipe(
          packagesState.workspaces,
          A.mapWithIndex((i, w) => (
            <Box width={60} key={w.app.package.name}>
              {i === highlighted ? (
                <Text wrap="truncate" color="yellow">
                  {">"}
                </Text>
              ) : (
                <Text> </Text>
              )}
              <Gradient name={toGradient(w.app.package.name)}>
                {w.app.package.name}:{w.app.package.version}
              </Gradient>
              <Spacer />
              <Text>Status: {w.state}</Text>
            </Box>
          ))
        )}

        {/* <Newline />
      <Newline />
      {gradients.map((s) => (
        <Gradient name={s}>{s}asdfkjnasdfkjlfsdklj</Gradient>
      ))} */}
      </Box>
    </>
  );

  // return (
  //   <>
  //     <Gradient name="pastel">@simspace/portal-client</Gradient>
  //     <Gradient name="passion">@simspace/monorail</Gradient>
  //     <Gradient name="morning">@simspace/fp-ts-ext</Gradient>
  //     <Gradient name="teen">@simspace/redux-ext</Gradient>
  //     <Gradient name="summer">@simspace/simspace-schema</Gradient>
  //     {/* <Gradient name="cristal">asdflkjlksjfas;dlkfjasdf;lkj</Gradient>
  //     <Gradient name="teen">asdflkjlksjfas;dlkfjasdf;lkj</Gradient>
  //     <Gradient name="summer">asdflkjlksjfas;dlkfjasdf;lkj</Gradient> */}
  //   </>
  // );

  // return h(
  //   Box,
  //   {},
  //   pipe(
  //     workspaces,
  //     A.mapWithIndex((i, w) =>
  //       h(
  //         Box,
  //         { key: w.package.name },
  //         h(
  //           Box,
  //           {
  //             borderStyle: "round",
  //             borderColor: i === highlighted ? "yellow" : "green",
  //             key: "a",
  //           },
  //           h(Text, {}, `${w.package.name}:${w.package.version}`),
  //           w.localDeps.map((ld) =>
  //             h(
  //               Text,
  //               { color: "gray", key: ld.name },
  //               `${ld.name}:${ld.version}`
  //             )
  //           )
  //         ),
  //         h(Newline, { key: "b" })
  //       )
  //     )
  //   )
  // );
};
