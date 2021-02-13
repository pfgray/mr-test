import { spawn } from "child_process";
// @ts-ignore
import * as kill from "tree-kill";

const child = spawn("yarn", ["workspace", "@mr-test/app", "start"]);

child.stdout.on("data", (data) => {
  console.log(data.toString());
});

child.stderr.on("data", (data) => {
  console.log(data.toString());
});

child.on("close", (code) => {
  console.log("closed: ", code);
});

setTimeout(() => {
  console.log("aborting");
  // @ts-ignore
  kill(child.pid);
  //child.kill("SIGINT");
  console.log("aborted");
}, 5000);
