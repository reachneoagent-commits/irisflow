use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

static PEN_ON: AtomicBool = AtomicBool::new(false);
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;

// Where the main window was before sharing shrank it, so stopping the share puts it back.
#[derive(Default)]
struct Saved(Mutex<Option<(PhysicalPosition<i32>, PhysicalSize<u32>, bool)>>);

// Starting a screen share: the main window becomes a small always-on-top control window that is
// hidden from screen capture (no "mirror inside a mirror"), and a transparent layer opens over the
// screen so the presenter sees what viewers draw. That layer is also hidden from capture, because
// viewers already see strokes in their own window. Stopping the share undoes all of it.
#[tauri::command]
fn share_mode(app: tauri::AppHandle, on: bool) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or("no main window")?;
    let saved = app.state::<Saved>();
    eprintln!("[irisflow] share_mode on={on}");
    if on {
        // Windows: the full-screen transparent layer is the suspected cause of the frozen screen
        // (WebView2 can swallow every click), so Windows shares without the drawing layer.
        if !cfg!(windows) && app.get_webview_window("overlay").is_none() {
            let m = app.primary_monitor().map_err(|e| e.to_string())?.ok_or("no monitor")?;
            let (pos, size, scale) = (m.position(), m.size(), m.scale_factor());
            let ov = WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("overlay.html".into()))
                .title("Irisflow drawing")
                .transparent(true)
                .decorations(false)
                .always_on_top(true)
                .resizable(false)
                .skip_taskbar(true)
                .shadow(false)
                .content_protected(true)
                .visible_on_all_workspaces(true)
                .focused(false)
                .position(pos.x as f64 / scale, pos.y as f64 / scale)
                .inner_size(size.width as f64 / scale, size.height as f64 / scale)
                .build()
                .map_err(|e| e.to_string())?;
            ov.set_ignore_cursor_events(true).map_err(|e| e.to_string())?; // clicks pass through until the pen is on
            // Windows can drop the click-through flag while the new window is still being set up, which
            // leaves a full-screen layer eating every click. Apply it again once the window has settled.
            let ov2 = ov.clone();
            std::thread::spawn(move || {
                for ms in [150u64, 600, 1500] {
                    std::thread::sleep(std::time::Duration::from_millis(ms));
                    if ov2.is_visible().unwrap_or(false) && !PEN_ON.load(Ordering::SeqCst) {
                        let _ = ov2.set_ignore_cursor_events(true);
                    }
                }
            });
        }
        let mut s = saved.0.lock().unwrap();
        if s.is_none() {
            // A maximized or full-screen window ignores resizing (the Windows freeze): leave that state first.
            let was_max = main.is_maximized().unwrap_or(false) || main.is_fullscreen().unwrap_or(false);
            if main.is_fullscreen().unwrap_or(false) { let _ = main.set_fullscreen(false); }
            if main.is_maximized().unwrap_or(false) { let _ = main.unmaximize(); }
            if main.is_minimized().unwrap_or(false) { let _ = main.unminimize(); }
            if let (Ok(p), Ok(z)) = (main.outer_position(), main.outer_size()) { *s = Some((p, z, was_max)); }
        }
        main.set_content_protected(true).map_err(|e| e.to_string())?;
        main.set_always_on_top(true).map_err(|e| e.to_string())?;
        if let Ok(Some(m)) = app.primary_monitor() {
            let (mp, ms, scale) = (m.position(), m.size(), m.scale_factor());
            let (w, h) = ((420.0 * scale) as i32, (600.0 * scale) as i32);
            let _ = main.set_size(PhysicalSize::new(w as u32, h as u32));
            let _ = main.set_position(PhysicalPosition::new(mp.x + ms.width as i32 - w - (24.0 * scale) as i32, mp.y + ms.height as i32 - h - (80.0 * scale) as i32));
        }
        // The control window must sit above the drawing layer, or the layer covers it.
        let _ = main.set_always_on_top(false);
        let _ = main.set_always_on_top(true);
        let _ = main.set_focus();
    } else {
        if let Some(ov) = app.get_webview_window("overlay") { let _ = ov.close(); }
        main.set_content_protected(false).map_err(|e| e.to_string())?;
        main.set_always_on_top(false).map_err(|e| e.to_string())?;
        PEN_ON.store(false, Ordering::SeqCst);
        if let Some((p, z, was_max)) = saved.0.lock().unwrap().take() {
            let _ = main.set_size(z);
            let _ = main.set_position(p);
            if was_max { let _ = main.maximize(); }
        }
        let _ = app.emit("iris-pen-state", false);
    }
    Ok(())
}

// Presenter's pen: on = the layer catches mouse clicks so they can draw; off = clicks pass through to
// whatever is being shared. Both windows hear the new state.
#[tauri::command]
fn overlay_pen(app: tauri::AppHandle, on: bool) -> Result<bool, String> {
    let ov = app.get_webview_window("overlay").ok_or("not sharing")?;
    PEN_ON.store(on, Ordering::SeqCst);
    ov.set_ignore_cursor_events(!on).map_err(|e| e.to_string())?;
    if on { let _ = ov.set_focus(); }
    app.emit("iris-pen-state", on).map_err(|e| e.to_string())?;
    Ok(on)
}

// Debug trail: the pages write what they see to the terminal the app was started from.
#[tauri::command]
fn log_line(msg: String) { eprintln!("[irisflow] {msg}"); }

// Server address: IRISFLOW_URL at run time, else the one set when the app was built, else local dev.
fn site_url(app: &tauri::AppHandle, path: &str) -> tauri::Result<tauri::Url> {
    let url = std::env::var("IRISFLOW_URL")
        .ok()
        .or_else(|| option_env!("IRISFLOW_URL").map(String::from))
        .filter(|u| !u.is_empty())
        .unwrap_or_else(|| "http://localhost:5173".into());
    let mut url: tauri::Url = url.parse().map_err(|_| tauri::Error::InvalidWebviewUrl("bad IRISFLOW_URL"))?;
    if !path.is_empty() { url.set_path(path); }
    // The app version rides on the address so a new installer never shows a page the webview saved earlier.
    url.query_pairs_mut().append_pair("app", &app.package_info().version.to_string());
    Ok(url)
}

// Main window sized to the screen it opens on: up to 1280x840, never more than 90% of the
// screen (leaves room for taskbar/dock/menu bar), centered, resizable down to phone width.
fn open_main(app: &tauri::AppHandle, path: &str) -> tauri::Result<()> {
    let (mut w, mut h) = (1280.0_f64, 840.0_f64);
    if let Ok(Some(m)) = app.primary_monitor() {
        let s = m.scale_factor();
        w = w.min(m.size().width as f64 / s * 0.9);
        h = h.min(m.size().height as f64 / s * 0.9);
    }
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(site_url(app, path)?))
        .title("Irisflow")
        .inner_size(w.max(360.0), h.max(560.0))
        .min_inner_size(360.0, 560.0)
        .center()
        .resizable(true)
        .build()?;
    Ok(())
}

// A meeting link opened from outside: irisflow://r/<code> (the website's "Open in the app" button),
// or a pasted https link to /r/<code> or /s/<code>. Joins that meeting in the main window.
fn code_from(url: &tauri::Url) -> Option<String> {
    let is_code = |s: &str| s.len() >= 3 && s.len() <= 64 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') && s.contains('-');
    let host = url.host_str().unwrap_or("").to_lowercase();
    let parts: Vec<String> = std::iter::once(host).chain(url.path_segments().into_iter().flatten().map(|s| s.to_lowercase())).filter(|s| !s.is_empty()).collect();
    parts.into_iter().rev().find(|s| is_code(s))
}

fn open_link(app: &tauri::AppHandle, urls: Vec<tauri::Url>) {
    let Some(code) = urls.iter().find_map(code_from) else { return };
    let Ok(target) = site_url(app, &format!("/r/{code}")) else { return };
    match app.get_webview_window("main") {
        Some(w) => { let _ = w.navigate(target); let _ = w.show(); let _ = w.unminimize(); let _ = w.set_focus(); }
        None => { let _ = open_main(app, &format!("/r/{code}")); }
    }
}

// Windows laptops with two graphics cards (Intel + NVIDIA/AMD) often run apps on the weak one. Ask Windows
// to use the high-performance card for this app, and tell the web engine to prefer it too.
#[cfg(windows)]
fn prefer_fast_gpu() {
    use std::os::windows::process::CommandExt;
    if std::env::var_os("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").is_none() {
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--force_high_performance_gpu");
    }
    if let Ok(exe) = std::env::current_exe() {
        let _ = std::process::Command::new("reg")
            .args(["add", r"HKCU\Software\Microsoft\DirectX\UserGpuPreferences", "/v", &exe.to_string_lossy(), "/t", "REG_SZ", "/d", "GpuPreference=2;", "/f"])
            .creation_flags(0x0800_0000) // no console window
            .status();
    }
}

fn main() {
    #[cfg(windows)]
    prefer_fast_gpu();
    tauri::Builder::default()
        .manage(Saved::default())
        // A second launch (Windows opens a new process for each link) hands its link to the running app.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let urls: Vec<tauri::Url> = args.iter().filter_map(|a| a.parse().ok()).collect();
            open_link(app, urls);
            if let Some(w) = app.get_webview_window("main") { let _ = w.set_focus(); }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let handle = app.handle().clone();
            // Launched by a link (cold start) opens that meeting; otherwise the home page.
            let start = app.deep_link().get_current().ok().flatten().unwrap_or_default();
            match start.iter().find_map(code_from) {
                Some(code) => open_main(&handle, &format!("/r/{code}"))?,
                None => open_main(&handle, "")?,
            }
            let h = handle.clone();
            app.deep_link().on_open_url(move |e| open_link(&h, e.urls()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![share_mode, overlay_pen, log_line])
        .run(tauri::generate_context!())
        .expect("error while running Irisflow");
}
