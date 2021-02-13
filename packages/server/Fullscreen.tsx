import React, { FC, useEffect } from "react";

const enterAltScreenCommand = "\x1b[?1049h";
const leaveAltScreenCommand = "\x1b[?1049l";

const exitFullScreen = () => {
  process.stdout.write(leaveAltScreenCommand);
};

export const FullScreen: FC<{}> = ({ children }) => {
  useEffect(() => {
    process.stdout.write(enterAltScreenCommand);
    // destroy alternate screen on unmount
    return exitFullScreen;
  }, []);
  return <>{children}</>;
};

export { exitFullScreen };
