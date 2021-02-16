import * as T from "@effect-ts/core/Effect";
import { flow, pipe } from "@effect-ts/core/Function";
import chokidar from "chokidar";

export const Watch = {
  dir: (dirname: string, onChange: (path: string) => T.UIO<unknown>) =>
    T.effectAsyncInterrupt<unknown, number, 0>((cb) => {
      console.log("watching", dirname);
      const watcher = chokidar.watch(dirname);
      watcher.on("change", flow(onChange, T.run));
      return T.effectTotal(() => {
        // hmm, chokidar docs say .close() returns a promise,
        // but the types say otherwise...
        watcher.close();
      });
    }),
};
