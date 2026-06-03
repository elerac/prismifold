---
name: openexr-io
description: OpenEXR image I/O guidance for choosing channel names, viewer-compatible grouping patterns, and Python read/write snippets using OpenImageIO. Use when creating, inspecting, converting, validating, or documenting .exr files for this viewer or for OpenEXR interoperability.
---

# OpenEXR I/O

## Core Guidance

Prefer simple, default-compatible OpenEXR files before relying on custom viewer rules.

- Include `R/G/B` or `R/G/B/A` when the image has natural color channels. This is recommended for interoperability, not required for specialized data-only files.
- Use `zip` or `piz` for strict lossless output. Avoid `pxr24`, `b44`, `b44a`, `dwaa`, and `dwab` when exact sample values must round-trip.
- Prefer the channel names below. Custom channel-recognition regexes exist in the viewer, but generated files should not depend on user customization.

## Channel Names

Use exact names and complete groups. Grouping is per decoded layer, so do not rely on an EXR part or layer name to complete a channel set.

- Main color: `R`, `G`, `B`, optional `A`.
- Layer-style color: `layer.R`, `layer.G`, `layer.B`, optional `layer.A`.
- Alpha companions: bare `A`, or matching `layer.A` for `layer.R/G/B` and `depth.A` for `depth.Z`.
- Depth: prefer `Z` or `depth.Z`; use positive finite values for depth projection.
- Generic vectors: `vector.X`, `vector.Y`, `vector.Z`.
- Normal maps: `N.X/Y/Z`, `normal.X/Y/Z`, or names ending in `_normal.X/Y/Z`. Normal-map recognition takes precedence over generic XYZ grouping.
- UV or motion vectors: `motion.U`, `motion.V`, optional `motion.A`.
- Mueller matrices: complete `M00` through `M33`; RGB Mueller uses `M00.R/G/B` through `M33.R/G/B`.

## Spectral Channels

Use wavelength channel names ending in `nm`. The viewer sorts spectral samples by numeric wavelength and groups a series when it has at least two unique wavelengths.

- Bare series: `400nm`, `500nm`, `600nm` forms one spectral series.
- Named series: `reflectance.400nm`, `reflectance.500nm`, `reflectance.600nm` becomes a separate grouped series keyed by `reflectance`.
- Decimal wavelengths are accepted with a point or comma, such as `532.5nm` or `532,5nm`.
- Keep units in the channel name. Do not write wavelength names without the `nm` suffix if you expect automatic spectral grouping.

## Stokes Channels

Use `S0`, `S1`, `S2`, and optionally `S3`. Keep Stokes components in complete, matching sets.

- Scalar Stokes: use `S0`, `S1`, and `S2` as the minimum complete linear Stokes set; add `S3` when circular or full Stokes data is available.
- Suffixed scalar Stokes: use matching suffixes for related scalar sets, such as `S0.Y`, `S1.Y`, `S2.Y`, and optional `S3.Y`.
- RGB Stokes: use complete RGB component sets, such as `S0.R/G/B`, `S1.R/G/B`, and `S2.R/G/B`; add `S3.R/G/B` when full RGB Stokes data is available.
- Spectral Stokes: use one complete `S0/S1/S2` set per wavelength, such as `S0.500nm`, `S1.500nm`, and `S2.500nm`; use at least two wavelengths for a spectral Stokes series. Add `S3.<wavelength>nm` for every wavelength when full spectral Stokes data is available.

## Compression

Use OpenEXR compression names as lowercase OIIO strings.

- `zip`: lossless zlib compression in 16-scanline blocks. Use as a dependable default for many generated images.
- `piz`: lossless wavelet-based compression. Prefer for photographic, grainy, or high-frequency images when size matters.
- `zips`: lossless zlib compression one scanline at a time. Use only when scanline-local access is more important than compression ratio.

## Basic OpenImageIO Python

Read metadata and pixels:

```python
from pathlib import Path

import numpy as np
import OpenImageIO as oiio


def read_exr(path: Path) -> tuple[oiio.ImageSpec, list[str], np.ndarray]:
    image_input = oiio.ImageInput.open(str(path))
    if image_input is None:
        raise RuntimeError(f"Failed to open {path}")

    try:
        spec = image_input.spec()
        channel_names = list(spec.channelnames)
        pixels = image_input.read_image(format=oiio.FLOAT)
        if pixels is None:
            raise RuntimeError(f"Failed to read {path}: {image_input.geterror()}")
    finally:
        image_input.close()

    return spec, channel_names, np.asarray(pixels, dtype=np.float32)
```

Write named channels with lossless compression:

```python
from pathlib import Path

import numpy as np
import OpenImageIO as oiio


def write_exr(path: Path, pixels: np.ndarray, channel_names: list[str], compression: str = "zip") -> None:
    pixels = np.asarray(pixels, dtype=np.float32)
    if pixels.ndim != 3:
        raise ValueError(f"Expected HxWxC pixels, got {pixels.shape}")

    height, width, channels = pixels.shape
    if channels != len(channel_names):
        raise ValueError(f"Data has {channels} channels, names has {len(channel_names)}")

    spec = oiio.ImageSpec(width, height, channels, oiio.FLOAT)
    spec.channelnames = tuple(channel_names)
    spec.attribute("compression", compression)  # "zip" or "piz" for strict lossless output.

    if "A" in channel_names:
        spec.alpha_channel = channel_names.index("A")
    if "Z" in channel_names:
        spec.z_channel = channel_names.index("Z")

    path.parent.mkdir(parents=True, exist_ok=True)
    output = oiio.ImageOutput.create(str(path))
    if output is None:
        raise RuntimeError(f"Failed to create OpenEXR output for {path}")

    try:
        if not output.open(str(path), spec):
            raise RuntimeError(f"Failed to open {path}: {output.geterror()}")
        if not output.write_image(pixels):
            raise RuntimeError(f"Failed to write {path}: {output.geterror()}")
    finally:
        output.close()
```

Verify readback by channel-name presence and numeric tolerance, not by assuming arbitrary channel order is identical. The OpenEXR library may store channels in lexicographic order; OIIO treats `R/G/B/A/Z` specially and presents those first in conventional order when present.
