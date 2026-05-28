#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uDepthTexture;
uniform vec2 uViewport;
uniform vec2 uOutputSize;
uniform vec2 uScreenOrigin;
uniform vec2 uDepthOutputOrigin;
uniform vec2 uImageSize;
uniform float uDepthFocalLengthPx;
uniform float uDepthYawDeg;
uniform float uDepthPitchDeg;
uniform float uDepthZoom;
uniform float uDepthPointSizePx;
uniform ivec2 uDepthGridSize;
uniform int uDepthSampleStep;
uniform vec2 uDepthRange;

out vec2 vDepthPixel;
flat out int vDepthValid;

const float PI = 3.1415926535897932384626433832795;

bool isFiniteValue(float value) {
  return !(isnan(value) || isinf(value));
}

vec3 rotateYaw(vec3 value, float angleRad) {
  float c = cos(angleRad);
  float s = sin(angleRad);
  return vec3(
    c * value.x + s * value.z,
    value.y,
    -s * value.x + c * value.z
  );
}

vec3 rotatePitch(vec3 value, float angleRad) {
  float c = cos(angleRad);
  float s = sin(angleRad);
  return vec3(
    value.x,
    c * value.y - s * value.z,
    s * value.y + c * value.z
  );
}

void rejectVertex() {
  vDepthValid = 0;
  vDepthPixel = vec2(0.0);
  gl_PointSize = 0.0;
  gl_Position = vec4(2.0, 2.0, 1.0, 1.0);
}

void main() {
  int gridWidth = max(uDepthGridSize.x, 0);
  int gridHeight = max(uDepthGridSize.y, 0);
  int sampleStep = max(uDepthSampleStep, 1);
  if (
    gridWidth <= 0 ||
    gridHeight <= 0 ||
    uOutputSize.x <= 0.0 ||
    uOutputSize.y <= 0.0 ||
    uImageSize.x <= 0.0 ||
    uImageSize.y <= 0.0 ||
    gl_VertexID >= gridWidth * gridHeight
  ) {
    rejectVertex();
    return;
  }

  int gridX = gl_VertexID - (gl_VertexID / gridWidth) * gridWidth;
  int gridY = gl_VertexID / gridWidth;
  ivec2 pixel = ivec2(gridX * sampleStep, gridY * sampleStep);
  if (pixel.x >= int(uImageSize.x) || pixel.y >= int(uImageSize.y)) {
    rejectVertex();
    return;
  }

  float depth = texelFetch(uDepthTexture, pixel, 0).r;
  if (!isFiniteValue(depth) || depth <= 0.0) {
    rejectVertex();
    return;
  }

  float focalLengthPx = max(uDepthFocalLengthPx, 1.0);
  vec2 pixelCenter = vec2(float(pixel.x) + 0.5, float(pixel.y) + 0.5);
  vec3 point = vec3(
    (pixelCenter.x - uImageSize.x * 0.5) * depth / focalLengthPx,
    (uImageSize.y * 0.5 - pixelCenter.y) * depth / focalLengthPx,
    depth
  );

  float minDepth = uDepthRange.x;
  float maxDepth = max(uDepthRange.y, minDepth + 1.0e-6);
  float centerDepth = (minDepth + maxDepth) * 0.5;
  float depthSpan = max(maxDepth - minDepth, 1.0e-6);
  float xSpan = uImageSize.x * maxDepth / focalLengthPx;
  float ySpan = uImageSize.y * maxDepth / focalLengthPx;
  float sceneScale = max(max(xSpan, ySpan), depthSpan);
  point = vec3(point.x, point.y, point.z - centerDepth) / max(sceneScale, 1.0e-6);

  float yawRad = uDepthYawDeg * PI / 180.0;
  float pitchRad = uDepthPitchDeg * PI / 180.0;
  vec3 cameraPoint = rotatePitch(rotateYaw(point, -yawRad), -pitchRad);
  float zoom = max(uDepthZoom, 0.05);
  float aspect = max(uViewport.x / max(uViewport.y, 1.0), 1.0e-6);
  vec2 projected = vec2(cameraPoint.x / aspect, cameraPoint.y) * zoom * 2.0;
  vec2 fullViewportScreen = vec2(
    (projected.x * 0.5 + 0.5) * uViewport.x,
    (0.5 - projected.y * 0.5) * uViewport.y
  );
  vec2 outputScreen = fullViewportScreen - uDepthOutputOrigin;
  vec2 outputNdc = vec2(
    outputScreen.x / max(uOutputSize.x, 1.0) * 2.0 - 1.0,
    1.0 - outputScreen.y / max(uOutputSize.y, 1.0) * 2.0
  );

  vDepthValid = 1;
  vDepthPixel = vec2(pixel);
  gl_PointSize = max(uDepthPointSizePx, 1.0);
  gl_Position = vec4(outputNdc, clamp(cameraPoint.z * zoom, -1.0, 1.0), 1.0);
}
