//! Bindings for the parts of the `domicile` object this shell uses.
//!
//! `domicile` is the desktop the engine hands to `Shell`: see
//! /docs/WRITING-A-SHELL.md. Each binding names a member of its TypeScript
//! type in `@domicile-desktop/sdk`.

use js_sys::Function;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    /// The desktop.
    #[derive(Clone)]
    pub type Domicile;

    #[wasm_bindgen(method, getter)]
    pub fn windows(this: &Domicile) -> Windows;

    #[wasm_bindgen(method, getter)]
    pub fn processes(this: &Domicile) -> Processes;

    #[wasm_bindgen(method, getter)]
    pub fn keyboard(this: &Domicile) -> Keyboard;

    /// `domicile.windows`: the open windows and which has focus.
    #[derive(Clone)]
    pub type Windows;

    /// Every open window, or `undefined` before the first list arrives.
    #[wasm_bindgen(method, getter)]
    pub fn list(this: &Windows) -> Option<Vec<Window>>;

    /// The focused window's app id.
    #[wasm_bindgen(method, getter)]
    pub fn focused(this: &Windows) -> Option<String>;

    /// Calls `listener` on `"change"` or `"focuschange"`. Returns the function
    /// that stops it.
    #[wasm_bindgen(method)]
    pub fn on(this: &Windows, event: &str, listener: &Function) -> Function;

    /// One open window.
    pub type Window;

    #[wasm_bindgen(method, getter, js_name = appId)]
    pub fn app_id(this: &Window) -> String;

    /// The window a menu or tooltip belongs to.
    #[wasm_bindgen(method, getter)]
    pub fn parent(this: &Window) -> JsValue;

    /// `domicile.processes`.
    pub type Processes;

    /// Runs `argv`, with no shell in between.
    #[wasm_bindgen(method)]
    pub fn launch(this: &Processes, argv: Vec<String>);

    /// `domicile.keyboard`.
    pub type Keyboard;

    /// Takes `chord`, such as `"Meta+Return"`, from the focused window.
    #[wasm_bindgen(method)]
    pub fn grab(this: &Keyboard, chord: &str);

    /// Calls `listener` with a `Shortcut` on `"shortcut"`. Returns the function
    /// that stops it.
    #[wasm_bindgen(method)]
    pub fn on(this: &Keyboard, event: &str, listener: &Function) -> Function;

    /// A grabbed chord, pressed.
    pub type Shortcut;

    #[wasm_bindgen(method, getter)]
    pub fn chord(this: &Shortcut) -> String;
}
