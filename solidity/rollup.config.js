import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import builtins from "builtin-modules";
import typescript from "@rollup/plugin-typescript";
const bundle = (name) => ({
  input: `./src/autotasks/${name}.ts`,
  output: {
    file: `dist/tasks/${name}/index.js`,
    format: "cjs",
    exports: "auto",
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json({ compact: true }),
    typescript({ compilerOptions: { module: "esnext" } }),
  ],
  external: [
    ...builtins,
    /^ethers(\/.*)?$/,
    "web3",
    "axios",
    /^defender-relay-client(\/.*)?$/,
    "hardhat",
  ],
});
export default [bundle(`relay`), bundle(`signing`), bundle("transfer")];
