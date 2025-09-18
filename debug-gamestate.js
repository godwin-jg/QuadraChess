// Debug script to test baseInitialState
const { baseInitialState } = require("./state/gameSlice.ts");

console.log("baseInitialState keys:", Object.keys(baseInitialState));
console.log(
  "baseInitialState sample:",
  JSON.stringify(baseInitialState, null, 2)
);
