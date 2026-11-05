// Loads the wasm, then hands Domicile the `Shell` that Rust exports.
import init from "./pkg/dioxus_shell.js";

await init();

export { Shell } from "./pkg/dioxus_shell.js";
