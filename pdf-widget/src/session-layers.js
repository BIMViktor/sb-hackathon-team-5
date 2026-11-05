// Project-wide layer definitions for this tab. Drawings keep separate geometry.
export class SessionLayers {
  constructor() {
    this.items = [{ id: "base", name: "Allmänt", visible: true }];
    this.activeId = "base";
  }
  get active() {
    return this.items.find((layer) => layer.id === this.activeId) || null;
  }
  name(value, exceptId) {
    const name = String(value || "").trim();
    if (!name || name.length > 64)
      throw new Error("Ange ett lagernamn med 1–64 tecken.");
    if (
      this.items.some(
        (layer) =>
          layer.id !== exceptId &&
          layer.name.toLocaleLowerCase("sv") === name.toLocaleLowerCase("sv"),
      )
    )
      throw new Error("Det finns redan ett lager med det namnet.");
    return name;
  }
  create(value) {
    const layer = {
      id: crypto.randomUUID(),
      name: this.name(value),
      visible: true,
    };
    this.items.push(layer);
    this.activate(layer.id);
    return layer;
  }
  rename(id, value) {
    const layer = this.items.find((item) => item.id === id);
    if (!layer) throw new Error("Lagret finns inte.");
    layer.name = this.name(value, id);
    return layer;
  }
  activate(id) {
    const layer = this.items.find((item) => item.id === id);
    if (!layer) throw new Error("Lagret finns inte.");
    layer.visible = true;
    this.activeId = id;
    return layer;
  }
  toggle(id) {
    const layer = this.items.find((item) => item.id === id);
    if (!layer) return;
    layer.visible = !layer.visible;
    if (!layer.visible && this.activeId === id)
      this.activeId = this.items.find((item) => item.visible)?.id || null;
    return layer;
  }
  isVisible(id = "base") {
    return this.items.some(
      (layer) => layer.id === (id || "base") && layer.visible,
    );
  }
}
