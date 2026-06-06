# Changelog

## 0.2.0

Plenoview v0.2.0 is the first release under the new Plenoview name, replacing Prismifold branding while keeping the OpenEXR inspection workflow.

- Added the VS Code extension package for readonly `.exr` custom editors with local file/folder loading, viewer modes, metadata, pane layouts, rulers, and PNG/ZIP exports.
- Added the 3D viewer for RGB plus depth/position data, with freer point-cloud navigation, probes, spectral plot support, and embed auto-orbit controls.
- Expanded embeds and project pages with `<plenoview-viewer>`, `window.Plenoview`, panorama auto-rotation, refreshed gallery screenshots, and a Middlebury RGB+position sample.
- Improved larger-session behavior with automatic display cache budgeting, memory accounting/eviction, decode reservations, natural channel sorting, and additional built-in colormaps.
- Improved desktop polish with native titlebar chrome, updated release assets, and verified desktop/VS Code packaging.

## 0.1.0

- Initial Visual Studio Code extension release.
- Added readonly OpenEXR custom editor for `.exr` files.
- Added Plenoview viewer webview with local file and folder loading.
- Added VS Code command bridge for viewer modes, reload, close, metadata, settings, rulers, and pane layout.
- Added PNG, screenshot, batch ZIP, and colormap export support through VS Code save dialogs.
- Packaged Plenoview assets, WebAssembly decoder, colormaps, and extension icon.
