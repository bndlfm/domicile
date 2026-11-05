//! The shell from /docs/SHELL-QUICKSTART.md, in Rust with Dioxus:
//!
//! - Every window side by side, the focused one outlined.
//! - A box at the bottom that runs the command typed in it.
//! - Meta+Enter opens `kitty`.

mod domicile;

use dioxus::prelude::*;
use domicile::{Domicile, Shortcut};
use futures_channel::mpsc;
use futures_util::StreamExt;
use wasm_bindgen::prelude::*;

/// Dioxus's elements and Domicile's `<app app-id>`, which draws a window.
#[allow(non_camel_case_types, unused_imports)]
mod dioxus_elements {
    pub use dioxus::html::*;

    pub mod elements {
        pub use super::app;
        pub use dioxus::html::elements::*;
    }

    pub mod app {
        pub use dioxus::html::global_attributes::*;

        pub const TAG_NAME: &str = "app";
        pub const NAME_SPACE: Option<&str> = None;
    }
}

/// Domicile calls this with the element to draw in and the desktop.
#[wasm_bindgen(js_name = Shell)]
pub fn shell(root: web_sys::Element, domicile: Domicile) {
    let desktop = VirtualDom::new(Desktop).with_root_context(domicile);
    dioxus::web::launch::launch_virtual_dom(desktop, dioxus::web::Config::new().rootelement(root));
}

/// A window this shell draws.
#[derive(Clone, PartialEq)]
struct Shown {
    app_id: String,
    focused: bool,
}

/// Every window side by side, the focused one outlined.
#[component]
fn Desktop() -> Element {
    let windows = use_windows();
    rsx! {
        main {
            display: "flex",
            gap: "8px",
            height: "100vh",
            padding: "8px",
            for window in windows() {
                app {
                    key: "{window.app_id}",
                    "app-id": window.app_id.clone(),
                    border_radius: "8px",
                    flex: "1",
                    outline: if window.focused { "2px solid royalblue" } else { "none" },
                }
            }
            Launcher {}
        }
    }
}

/// The windows to draw, kept up to date. Menus and tooltips have a parent;
/// this shell leaves them out.
fn use_windows() -> Signal<Vec<Shown>> {
    let windows = use_context::<Domicile>().windows();
    let read = {
        let windows = windows.clone();
        move || {
            let focused = windows.focused();
            windows
                .list()
                .unwrap_or_default()
                .into_iter()
                .filter(|window| window.parent().is_undefined())
                .map(|window| {
                    let app_id = window.app_id();
                    Shown {
                        focused: focused.as_ref() == Some(&app_id),
                        app_id,
                    }
                })
                .collect()
        }
    };
    let mut shown = use_signal(read.clone());
    // Desktop events arrive outside Dioxus, so they go through a channel.
    use_future(move || {
        let read = read.clone();
        let windows = windows.clone();
        async move {
            let (send, mut changes) = mpsc::unbounded::<()>();
            let notify = Closure::<dyn Fn()>::new(move || {
                send.unbounded_send(())
                    .expect("the future reading changes runs as long as the page");
            });
            windows.on("change", notify.as_ref().unchecked_ref());
            windows.on("focuschange", notify.as_ref().unchecked_ref());
            while changes.next().await.is_some() {
                shown.set(read());
            }
            // The page ends first; this keeps `notify` alive until then.
            drop(notify);
        }
    });
    shown
}

/// A box that runs the command typed in it, and a terminal on Meta+Enter.
#[component]
fn Launcher() -> Element {
    let domicile = use_context::<Domicile>();
    let mut command = use_signal(String::new);
    let launch = use_callback({
        let domicile = domicile.clone();
        move |argv: Vec<String>| domicile.processes().launch(argv)
    });
    use_hook(move || {
        let keyboard = domicile.keyboard();
        keyboard.grab("Meta+Return");
        let shortcut = Closure::<dyn Fn(Shortcut)>::new(move |shortcut: Shortcut| {
            if shortcut.chord() == "Meta+Return" {
                launch(vec!["kitty".to_owned()]);
            }
        });
        keyboard.on("shortcut", shortcut.as_ref().unchecked_ref());
        // The shell lives as long as the page.
        shortcut.forget();
    });
    rsx! {
        form {
            bottom: "16px",
            left: "50%",
            position: "fixed",
            translate: "-50%",
            onsubmit: move |event| {
                event.prevent_default();
                let argv: Vec<String> = command().split_whitespace().map(str::to_owned).collect();
                if !argv.is_empty() {
                    launch(argv);
                }
                command.set(String::new());
            },
            input {
                placeholder: "Run an app, like firefox",
                value: "{command}",
                oninput: move |event| command.set(event.value()),
            }
        }
    }
}
