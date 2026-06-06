# Plenoview

Plenoview is an OpenEXR viewer for Visual Studio Code. It opens `.exr` files in a readonly custom editor and provides the same multichannel inspection tools as the Plenoview web and desktop viewer.

## Features

- Open `.exr` files directly in VS Code with a readonly custom editor.
- Decode OpenEXR files locally through the packaged Plenoview viewer and WebAssembly runtime.
- Inspect RGB, alpha, depth, masks, AOVs, vector channels, spectral channels, Stokes parameters, and Mueller matrix layers.
- Switch between image, panorama, and 3D viewer modes.
- Adjust exposure, gamma, colormaps, value ranges, zero-center mapping, and invalid-value display.
- Use pixel probes, metadata inspection, pixel rulers, ROI statistics, and high-zoom pixel labels.
- Open a folder of EXR files and keep multiple decoded images in one Plenoview session.
- Export PNG images, screenshot regions, batch ZIPs, and colormap gradients.
- Split the viewer into single, vertical, or horizontal panes for comparison.

## Usage

Open any `.exr` file in VS Code. Plenoview is registered as a custom editor for OpenEXR files.

You can also use the Command Palette:

- `Plenoview: Open EXR File`
- `Plenoview: Open EXR Folder`
- `Plenoview: Export Image`
- `Plenoview: Export Screenshot`
- `Plenoview: Export Batch`
- `Plenoview: Export Colormap`
- `Plenoview: Reload All`
- `Plenoview: Close All`
- `Plenoview: Show Metadata`
- `Plenoview: Image Viewer`
- `Plenoview: Panorama Viewer`
- `Plenoview: 3D Viewer`
- `Plenoview: Toggle Rulers`
- `Plenoview: Split Viewer Vertically`
- `Plenoview: Split Viewer Horizontally`
- `Plenoview: Reset Viewer Panes`

## Readonly Files

Plenoview never writes back to source `.exr` files. Saves are derived exports such as PNG screenshots, PNG image exports, ZIP batch exports, or colormap PNGs.

## Requirements

- VS Code 1.120.0 or newer.
- Desktop VS Code. Web extension support is not included in this first release.
- A machine with WebGL2 support for rendering.

## Privacy

Local EXR files are read through VS Code workspace APIs and decoded inside the Plenoview webview. The extension does not upload local files to a server.

Remote sample gallery entries may request HTTPS resources from their source hosts when selected.

## Links

- Plenoview web app: https://elerac.github.io/plenoview/app/
- Source repository: https://github.com/elerac/plenoview
- Issues: https://github.com/elerac/plenoview/issues
