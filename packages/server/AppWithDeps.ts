import { identity, literal, pipe } from "@effect-ts/core/Function";
import * as O from "@effect-ts/core/Option";
import * as E from "@effect-ts/core/Either";
import * as A from "@effect-ts/core/Array";
import { PackageJson } from "./packageJson";
import { traverse } from "fp-ts/lib/Option";

export type AppWithDeps = {
  dir: string;
  package: PackageJson;
  localDeps: PackageJson[];
};

const circularDep = (context: Array<PackageJson>) => ({
  tag: literal("CircularDepFound"),
  context,
});

export const findDeps = (
  allPackages: Array<AppWithDeps>,
  parentContext: Array<PackageJson>
) => (
  p: AppWithDeps
): E.Either<ReturnType<typeof circularDep>, Array<AppWithDeps>> => {
  return pipe(
    parentContext,
    A.findFirst((a) => a.name === p.package.name),
    O.fold(
      () =>
        pipe(p.localDeps, A.filterMap(findPackage(allPackages)), (deps) =>
          pipe(
            deps,
            A.map(findDeps(allPackages, parentContext.concat(p.package))),
            A.sequence(E.Applicative),
            E.map(A.chain(identity)),
            E.map((ds) => [...deps, ...ds])
          )
        ),
      () => E.left(circularDep(parentContext))
    )
  );
};

export const findPackage = (allPackages: Array<AppWithDeps>) => (
  p: PackageJson
) =>
  pipe(
    allPackages,
    A.findFirst((w) => w.package.name === p.name)
  );
