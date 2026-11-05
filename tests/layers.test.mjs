import test from "node:test";
import assert from "node:assert/strict";
import { SessionLayers } from "../pdf-widget/src/session-layers.js";
import { SessionAnnotations } from "../pdf-widget/src/session-annotations.js";
test("creating and renaming layers retains stable identity and active layer", () => {
  const layers = new SessionLayers();
  const layer = layers.create("KANALER_DRAGNING");
  assert.equal(layers.active.id, layer.id);
  assert.equal(layers.active.name, "KANALER_DRAGNING");
  layers.rename(layer.id, "KANALER_PLAN_1");
  assert.equal(layers.active.id, layer.id);
  assert.equal(layers.active.name, "KANALER_PLAN_1");
  assert.throws(() => layers.create("kanaler_plan_1"));
  assert.throws(() => layers.rename(layer.id, " "));
});
test("layers and active choice survive drawing changes while geometry stays with its drawing", () => {
  const layers = new SessionLayers(),
    annotations = new SessionAnnotations();
  const ventilation = layers.create("KANALER_DRAGNING");
  const drawingA = annotations.forDocument("app", "42", "A");
  drawingA.push({
    id: "a",
    layerId: layers.activeId,
    points: [[10, 20]],
    deleted: false,
  });
  const electric = layers.create("EL");
  const drawingB = annotations.forDocument("app", "42", "B");
  drawingB.push({
    id: "b",
    layerId: layers.activeId,
    points: [[100, 200]],
    deleted: false,
  });
  assert.equal(layers.items.length, 3);
  assert.equal(layers.activeId, electric.id);
  assert.equal(
    annotations.forDocument("app", "42", "A")[0].layerId,
    ventilation.id,
  );
  assert.deepEqual(annotations.forDocument("app", "42", "B")[0].points, [
    [100, 200],
  ]);
  layers.activate(ventilation.id);
  assert.equal(layers.activeId, ventilation.id);
  assert.equal(drawingA[0].layerId, ventilation.id);
  assert.equal(drawingB[0].layerId, electric.id);
});
test("hidden layers cannot be active or hit-selected until deliberately activated", () => {
  const layers = new SessionLayers(),
    layer = layers.create("KANALER");
  layers.toggle(layer.id);
  assert.equal(layers.isVisible(layer.id), false);
  assert.equal(layers.activeId, "base");
  layers.toggle("base");
  assert.equal(layers.active, null);
  layers.activate(layer.id);
  assert.equal(layers.isVisible(layer.id), true);
  assert.equal(layers.activeId, layer.id);
  assert.equal(layers.isVisible("base"), false);
});
test("a reload starts with a new unsaved layer set", () => {
  const layers = new SessionLayers();
  layers.create("KANALER");
  assert.deepEqual(
    new SessionLayers().items.map((l) => l.name),
    ["Allmänt"],
  );
});
