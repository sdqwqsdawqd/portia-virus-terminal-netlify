import assert from "node:assert/strict";
import test from "node:test";
import { ROUTE_PANEL_WIDTH, routeAnchorVisible, routePanelPlacement } from "./route-dropdown-position.ts";

// OWN-03 (owner 2026-11-21, clarification 32, 26.1-25): the panel of the routes is a layer over the page (position: fixed by the button's rectangle),
// so its place is computed here from three rectangles and nothing else: the button, the panel's own size and the visible screen.

const screen = { width: 1366, height: 768 };
const panel = { width: ROUTE_PANEL_WIDTH, height: 280 };

test("the panel is 320px wide", () => {
  assert.equal(ROUTE_PANEL_WIDTH, 320);
});

test("near the bottom of the screen the panel opens upwards, 4px above the button", () => {
  const place = routePanelPlacement({ top: 700, bottom: 732, left: 40, width: 340 }, panel, screen);
  assert.equal(place.side, "up");
  assert.equal(place.top, 700 - 4 - 280);
  assert.equal(place.bottom, 768 - 700 + 4, "anchored by its bottom edge, so a taller description grows upwards, away from the button");
  assert.equal(place.left, 40);
  assert.equal(place.width, 320);
  assert.equal(place.maxHeight, 700 - 4 - 8, "no taller than the room above, less 8px");
});

test("near the top of the screen the panel opens downwards, 4px below the button", () => {
  const place = routePanelPlacement({ top: 60, bottom: 92, left: 40, width: 340 }, panel, screen);
  assert.equal(place.side, "down");
  assert.equal(place.top, 92 + 4);
  assert.equal(place.bottom, null);
  assert.equal(place.maxHeight, 768 - 92 - 4 - 8);
});

test("down is kept while the panel fits below, even when there is more room above", () => {
  const place = routePanelPlacement({ top: 400, bottom: 432, left: 40, width: 340 }, panel, screen);
  assert.equal(place.side, "down");
  assert.equal(place.top, 436);
});

test("the larger side wins when the panel fits nowhere; the cap is the room less 8px, at least 120px", () => {
  const short = { width: 1366, height: 300 };
  const lowButton = routePanelPlacement({ top: 200, bottom: 232, left: 40, width: 340 }, panel, short);
  assert.equal(lowButton.side, "up", "196 above, 64 below");
  assert.equal(lowButton.maxHeight, 196 - 8);
  assert.equal(lowButton.top, 200 - 4 - (196 - 8), "the drawn height is the capped one");
  const highButton = routePanelPlacement({ top: 40, bottom: 72, left: 40, width: 340 }, panel, short);
  assert.equal(highButton.side, "down", "36 above, 224 below");
  assert.equal(highButton.maxHeight, 224 - 8);
  const tiny = routePanelPlacement({ top: 60, bottom: 92, left: 40, width: 340 }, panel, { width: 1366, height: 160 });
  assert.equal(tiny.maxHeight, 120, "never smaller than 120px");
});

test("a narrow screen: the panel is the screen less 32px and stands 16px from each edge", () => {
  const phone = { width: 300, height: 640 };
  const place = routePanelPlacement({ top: 100, bottom: 144, left: 12, width: 276 }, panel, phone);
  assert.equal(place.width, 300 - 32);
  assert.equal(place.left, 16);
});

test("at the right edge the panel moves left so it never leaves the screen", () => {
  const place = routePanelPlacement({ top: 100, bottom: 132, left: 1200, width: 150 }, panel, screen);
  assert.equal(place.width, 320);
  assert.equal(place.left, 1366 - 16 - 320);
  assert.ok(place.left + place.width <= screen.width - 16);
});

test("the button is visible while it stands inside every clipping box; out of one it is hidden and the panel closes", () => {
  const button = { top: 300, bottom: 332, left: 40, right: 380, width: 340, height: 32 };
  const form = { top: 100, bottom: 600, left: 0, right: 800, width: 800, height: 500 };
  assert.equal(routeAnchorVisible(button, [form]), true);
  assert.equal(routeAnchorVisible(button, []), true, "no scrolling ancestor: the screen decides alone");
  assert.equal(routeAnchorVisible({ ...button, top: 60, bottom: 92 }, [form]), false, "scrolled above the form's top edge");
  assert.equal(routeAnchorVisible({ ...button, top: 610, bottom: 642 }, [form]), false, "scrolled under the bottom edge");
  assert.equal(routeAnchorVisible({ ...button, top: 590, bottom: 622 }, [form]), true, "half visible still counts");
  assert.equal(routeAnchorVisible({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }, [form]), false, "a hidden (display: none) button has no box");
});
