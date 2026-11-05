// PDF native coordinates: zero-based page; unrotated user space, y up.
// PDF.js PageViewport owns CropBox offset, intrinsic rotation and UserUnit.
export function screenToPdf(point, camera, viewport) {
  return viewport.convertToPdfPoint(
    (point[0] - camera.x) / camera.scale,
    (point[1] - camera.y) / camera.scale,
  );
}
export function pdfToScreen(point, camera, viewport) {
  const p = viewport.convertToViewportPoint(...point);
  return [p[0] * camera.scale + camera.x, p[1] * camera.scale + camera.y];
}
export function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function hitStroke(p, points, tolerance) {
  if (points.length === 1)
    return Math.hypot(p[0] - points[0][0], p[1] - points[0][1]) <= tolerance;
  return points
    .slice(1)
    .some((b, i) => distanceToSegment(p, points[i], b) <= tolerance);
}
export function zoomAt(camera, anchor, factor) {
  const scale = Math.max(0.08, Math.min(12, camera.scale * factor));
  return {
    scale,
    x: anchor[0] - ((anchor[0] - camera.x) * scale) / camera.scale,
    y: anchor[1] - ((anchor[1] - camera.y) * scale) / camera.scale,
  };
}
export function pageSignature(page) {
  return {
    view: [...page.view],
    rotation: page.rotate,
    userUnit: page.userUnit,
  };
}
export function samePage(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
