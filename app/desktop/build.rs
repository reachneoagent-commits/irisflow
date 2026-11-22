// The app window loads IRISFLOW_URL (default: local dev server). Tauri only lets a remote page call
// our commands (the drawing overlay) if its origin is listed in the capability, so write that file
// from the same variable before Tauri reads it.
fn main() {
    println!("cargo:rerun-if-env-changed=IRISFLOW_URL");
    let url = std::env::var("IRISFLOW_URL").ok().filter(|u| !u.is_empty()).unwrap_or_else(|| "http://localhost:5173".into());
    let origin = url.trim_end_matches('/');
    let cap = format!(
        "{{\n  \"identifier\": \"main\",\n  \"windows\": [\"main\", \"overlay\"],\n  \"remote\": {{ \"urls\": [\"http://localhost:5173/*\", \"{origin}/*\"] }},\n  \"permissions\": [\"core:default\", \"core:event:default\", \"allow-share-mode\", \"allow-overlay-pen\"]\n}}\n"
    );
    std::fs::create_dir_all("capabilities").expect("create capabilities dir");
    std::fs::write("capabilities/main.json", cap).expect("write capability");
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["share_mode", "overlay_pen"])),
    )
    .expect("failed to run tauri-build");
}
