use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

// Open (or close) the presenter's transparent drawing layer over the primary screen.
#[tauri::command]
fn overlay_toggle(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(w) = app.get_webview_window("overlay") {
        w.close().map_err(|e| e.to_string())?;
        return Ok(false);
    }
    let m = app.primary_monitor().map_err(|e| e.to_string())?.ok_or("no monitor")?;
    let (pos, size, scale) = (m.position(), m.size(), m.scale_factor());
    WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("overlay.html".into()))
        .title("Irisflow drawing")
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .shadow(false)
        .visible_on_all_workspaces(true)
        .position(pos.x as f64 / scale, pos.y as f64 / scale)
        .inner_size(size.width as f64 / scale, size.height as f64 / scale)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(true)
}


// Main window sized to the screen it opens on: up to 1280x840, never more than 90% of the
// screen (leaves room for taskbar/dock/menu bar), centered, resizable down to phone width.
fn open_main(app: &tauri::AppHandle) -> tauri::Result<()> {
    let (mut w, mut h) = (1280.0_f64, 840.0_f64);
    if let Ok(Some(m)) = app.primary_monitor() {
        let s = m.scale_factor();
        w = w.min(m.size().width as f64 / s * 0.9);
        h = h.min(m.size().height as f64 / s * 0.9);
    }
    // Server address: IRISFLOW_URL at run time, else the one set when the app was built, else local dev.
    let url = std::env::var("IRISFLOW_URL")
        .ok()
        .or_else(|| option_env!("IRISFLOW_URL").map(String::from))
        .filter(|u| !u.is_empty())
        .unwrap_or_else(|| "http://localhost:5173".into());
    // The app version rides on the address so a new installer never shows a page the webview saved earlier.
    let mut url: tauri::Url = url.parse().map_err(|_| tauri::Error::InvalidWebviewUrl("bad IRISFLOW_URL"))?;
    url.query_pairs_mut().append_pair("app", &app.package_info().version.to_string());
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("Irisflow")
        .inner_size(w.max(360.0), h.max(560.0))
        .min_inner_size(360.0, 560.0)
        .center()
        .resizable(true)
        .build()?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| { open_main(app.handle())?; Ok(()) })
        .invoke_handler(tauri::generate_handler![overlay_toggle])
        .run(tauri::generate_context!())
        .expect("error while running Irisflow");
}
