"use client";

// The owner's spider walking on the «Паутина» web (BG-01, D-04..D-08). The artwork is static JSX made once from
// 09-spider.svg (no runtime markup). One requestAnimationFrame loop moves it and draws the waves along the threads:
// it reads no layout and sets no React state.

import { useEffect, useRef, type CSSProperties } from "react";
import { REST_NODE, createPulsePool, emitAtCrossing, emitPulse, planWalk, pulseShape, seeded, stepPulses, visibleNodes, walkPose, webGeometry } from "@/lib/wallpaper-web";

type LegId = "L1" | "L2" | "L3" | "L4" | "R1" | "R2" | "R3" | "R4";

// Measured once from 09-spider.svg: for each leg group, the path vertex nearest the body centre (325, 360), in artwork units.
const LEG_PIVOTS: Record<LegId, [number, number]> = {
  L1: [225.84, 320.44], L2: [219.46, 341.72], L3: [213.04, 401.78], L4: [237.32, 430.45],
  R1: [423.72, 320.25], R2: [429.68, 341.43], R3: [435.84, 401.19], R4: [411.79, 428.91],
};
// The head (eyes and fangs) points down the artwork, along +y, found from a render of the SVG.
const ARTWORK_HEADING = Math.PI / 2;
const legOrigin = (leg: LegId): CSSProperties => ({ transformOrigin: `${LEG_PIVOTS[leg][0]}px ${LEG_PIVOTS[leg][1]}px` });

// Gait (D-06): groups A and B swing in opposite phase, the right side mirrored so every leg pushes the same way.
const GAIT_A = ["L1", "R2", "L3", "R4"];
const legSign = (leg: string) => (GAIT_A.includes(leg) ? 1 : -1) * (leg.startsWith("R") ? -1 : 1);
const LEG_SWING = 12; // degrees either side of neutral
const STEP_CYCLE = 0.8; // seconds per full step cycle
const GAIT_EASE = 0.3; // legs reach neutral this fast after a stop
const TURN_TIME = 0.1; // body turn time constant: about 95% of a turn in 300 ms
const FIRST_WALK = 3.0; // 1.8 s fade delay + 0.6 s fade + about 0.6 s: something moves within 3 s
const MAX_DT = 0.05; // a slow frame never makes a jump

// Waves (D-05): a footstep pulse every half step cycle, a stronger one on arrival, at most 8 alive.
const PULSE_SLOTS = 8;
const STEP_PULSE = STEP_CYCLE / 2;
const STEP_PEAK = 0.6;
const ARRIVAL_PEAK = 0.75;

const round = (value: number) => Math.round(value * 10) / 10;

export function WallpaperSpider() {
  const wrapper = useRef<HTMLDivElement>(null);
  const waves = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = wrapper.current, overlay = waves.current, layer = element?.parentElement;
    if (!element || !overlay || !layer) return;
    const root = document.documentElement;
    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const legs = Array.from(element.querySelectorAll<SVGGElement>("[data-leg]"));
    const signs = legs.map((leg) => legSign(leg.dataset.leg ?? ""));
    const pulsePaths = Array.from(overlay.querySelectorAll("path"));
    const pool = createPulsePool(PULSE_SLOTS);
    const drawn = pulsePaths.map(() => false);
    const rand = seeded(41);
    const [restX, restY] = webGeometry.nodes[REST_NODE];

    // Size is cached here (a layout read outside the loop); the observer keeps it current.
    let scale = Math.max(layer.clientWidth / 1440, layer.clientHeight / 900);
    let visible = visibleNodes(layer.clientWidth, layer.clientHeight);
    const sizer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      scale = Math.max(width / 1440, height / 900);
      visible = visibleNodes(width, height);
    });
    sizer.observe(layer);

    let frame = 0, last = 0, time = 0;
    let node = REST_NODE, previous = -1, path: number[] | null = null;
    let walked = 0, rest = FIRST_WALK, x = restX, y = restY, stepClock = 0, steps = 0;
    // heading is where the body should face (travel direction); angle is how far the artwork is turned now.
    let heading = ARTWORK_HEADING, angle = 0, phase = 0, gait = 0, clean = true, legsNeutral = true;

    const clearPulses = () => {
      pool.slots.forEach((slot) => { slot.alive = false; });
      pulsePaths.forEach((pulse, index) => {
        if (!drawn[index]) return;
        pulse.setAttribute("d", "");
        pulse.style.opacity = "0";
        drawn[index] = false;
      });
    };

    const resetToRest = () => {
      node = REST_NODE; previous = -1; path = null; walked = 0; rest = FIRST_WALK; x = restX; y = restY; stepClock = 0; steps = 0;
      heading = ARTWORK_HEADING; angle = 0; phase = 0; gait = 0; clean = true; legsNeutral = true;
      element.style.transform = "";
      legs.forEach((leg) => { leg.style.rotate = ""; });
      clearPulses();
    };

    const drawPulses = () => {
      stepPulses(pool, time);
      pool.slots.forEach((slot, index) => {
        const pulse = pulsePaths[index];
        if (slot.alive) {
          const shape = pulseShape(slot, time);
          pulse.setAttribute("d", shape.points.length ? `M${shape.points.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join("L")}` : "");
          pulse.style.opacity = shape.opacity.toFixed(3);
          pulse.style.strokeWidth = shape.width.toFixed(2);
          drawn[index] = true;
        } else if (drawn[index]) {
          pulse.setAttribute("d", "");
          pulse.style.opacity = "0";
          drawn[index] = false;
        }
      });
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      time += dt;
      if (path) {
        walked += dt;
        stepClock += dt;
        const pose = walkPose(path, walked);
        x = pose.x; y = pose.y; heading = pose.heading;
        // Every half step the foot meets the thread: a pulse runs away both ways from the spider.
        if (Math.floor(stepClock / STEP_PULSE) > steps) {
          steps = Math.floor(stepClock / STEP_PULSE);
          emitPulse(pool, pose.edge, pose.at, 1, STEP_PEAK, time);
          emitPulse(pool, pose.edge, pose.at, -1, STEP_PEAK, time);
        }
        if (pose.done) {
          previous = path[path.length - 2];
          node = path[path.length - 1];
          path = null;
          rest = 3 + rand() * 3;
          emitAtCrossing(pool, node, ARRIVAL_PEAK, time);
        }
      } else if ((rest -= dt) <= 0) {
        const next = planWalk(node, previous, visible, rand);
        if (next.length > 1) { path = next; walked = 0; stepClock = 0; steps = 0; } else rest = 3 + rand() * 3;
      }
      drawPulses();
      const walking = path !== null;
      const turn = Math.atan2(Math.sin(heading - ARTWORK_HEADING - angle), Math.cos(heading - ARTWORK_HEADING - angle));
      angle += turn * (1 - Math.exp(-dt / TURN_TIME));
      gait += Math.max(-dt / GAIT_EASE, Math.min(dt / GAIT_EASE, (walking ? 1 : 0) - gait));
      if (walking) phase = (phase + dt / STEP_CYCLE) % 1;
      // A resting spider that has finished turning and straightening its legs needs no writes at all.
      const settled = !walking && gait === 0 && Math.abs(turn) < 1e-3;
      if (settled && clean) return;
      clean = settled;
      element.style.transform = `translate(${((x - restX) * scale).toFixed(2)}px, ${((y - restY) * scale).toFixed(2)}px) rotate(${((angle * 180) / Math.PI).toFixed(2)}deg)`;
      if (gait > 0 || !legsNeutral) legs.forEach((leg, index) => { leg.style.rotate = `${(LEG_SWING * Math.sin(2 * Math.PI * phase) * gait * signs[index]).toFixed(2)}deg`; });
      legsNeutral = gait === 0;
    };

    const motionOn = () => (root.dataset.motion ? root.dataset.motion === "full" : !reduceQuery.matches);
    // The loop runs only with motion on and a visible tab (T-09-04); «Выключены» puts the spider back at rest.
    const sync = () => {
      if (motionOn() && !document.hidden) {
        if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
        return;
      }
      cancelAnimationFrame(frame);
      frame = 0;
      if (!motionOn()) resetToRest();
    };
    const watcher = new MutationObserver(sync);
    watcher.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    document.addEventListener("visibilitychange", sync);
    reduceQuery.addEventListener("change", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
      sizer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduceQuery.removeEventListener("change", sync);
    };
  }, []);

  const [restX, restY] = webGeometry.nodes[REST_NODE];
  return <>
    <svg className="desktop-wallpaper wallpaper-web-pulses" viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMin slice" aria-hidden="true" ref={waves}>
      {Array.from({ length: PULSE_SLOTS }, (_, index) => <path key={index} d="" style={{ opacity: 0 }} />)}
    </svg>
    <div className="wallpaper-spider" ref={wrapper} style={{ "--rest-x": round(restX), "--rest-y": round(restY) } as CSSProperties}>
      <svg viewBox="0 0 649.5 768" aria-hidden="true">
        <g className="wallpaper-spider-leg" data-leg="R4" style={legOrigin("R4")}>
          <path className="wallpaper-spider-dark" d="M508.75,561.48c-2.79,3.63-4.55,9.33-5.88,13.68-1.07,3.5-1.56,8.15-.4,12.22l40.02-.67c1.17,6.17-1.23,8.84-4.02,13.46-10.23-.89-19.66-.96-32.04-.28l23.32,37.32c7.09,11.35,6.63,25.24-.91,36.39l-63.79,94.39c-4.05-5.56-9.24-14.64-7.79-21.73l7.77-38.02c5.09-5.24,13.65-29.06,23.11-32.49l-6.66,32.29,26.96-38.42c15.15-21.59-3.67-28.77-20.49-62.02-9.78-19.33-8.65-41.38,4.7-58.43l24.92-31.8c7.29-9.3,7.46-22.36-1.18-30.78l-24.66,21.99c-4.84-.71-10.28-2.08-11.19-7.52l28.18-23.85-13.03-6.82c-3.43-1.8-7.84-5.85-11.73-7.42l-27.99-11.31-9.72-26.08c17.52,7.12,34.96,14.35,52.85,22.78,13.52,6.37,25.68,15.46,34.79,27.09,12.43,15.87,12.37,37.15.16,53.04l-25.31,32.96Z" />
          <path className="wallpaper-spider-teal" d="M446.27,425.61l9.72,26.08,9.49,28.43,15.01-11.42c1.42-1.08,3.19-4.25,3.49-5.7,3.89,1.57,8.3,5.62,11.73,7.42-3.41,3.93-7.4,7.59-11.71,11.51l-12.53,11.4,9.08,7.75c.91,5.45,6.35,6.81,11.19,7.52l14.74,6.76c1.09,2.23-1.25,7.78-3.37,9.97l-5.57,5.75c-2.36,2.44-35.99-5.84-47.15-34.6l-21.31-54.92c-2.21-5.7-12.59-9.92-17.29-12.65,1.13-6.19,8.42-9.4,11.69-13.85,8.56-.1,15.21,7.48,22.79,10.56Z" />
          <path className="wallpaper-spider-teal" d="M538.47,600.18c2.79-4.62,5.19-7.3,4.02-13.46l.44-11.7-40.06.15c1.33-4.35,3.09-10.05,5.88-13.68l29.73.04c-3.93-5.52-10.12-11-8.98-14.31l10.17-13.88c12.71,9.88,21.41,23.58,23.37,40.84,2.52,22.19-7.78,44-26.22,58.77l-11.37-16.58c6.62-6.37,9.58-10.49,13.02-16.19Z" />
          <path className="wallpaper-spider-teal" d="M488.15,675.77c-9.47,3.43-18.02,27.24-23.11,32.49,1.04-5.09.83-12.35,2.49-17.96l5.42-18.35c3.33-11.27,9.33-26.38,21.41-31.75,5.87-2.61,12.84,11.5,9.03,16.32l-15.23,19.26Z" />
        </g>
        <g className="wallpaper-spider-leg" data-leg="R3" style={legOrigin("R3")}>
          <path className="wallpaper-spider-dark" d="M543.93,404.92l-18.68,4.79,7.99-30.25c-4.49-.79-8.19-2.06-12.71-.1l-8.46,33.41c-4.88-.12-9.17-.52-12.74-1.07-4.32-.66-7.8-2.24-11.68-3.72-8.05-3.08-15.2-7.37-22.56-12.05l-10.44-6.64c-3.1-1.97-6.69-5.42-8.65-8.02-.71-.24-1.33-.58-1.91-.95l-8.25,20.87,31.79,19.14c26.99,16.25,49.57,13.21,77.86,3.14l-1.57-18.55Z" />
          <path className="wallpaper-spider-teal" d="M613,415.36c1.22,6.27,5.05,15.89-.16,20.54-10.23,9.11-19.79,16.02-32.76,26.09l-4.71-10.9c-2.08-4.81-4.56-9.82-2.06-14.51l-.33-15.35-2.08-26.9c-1.88-24.31-27.62-38.27-50.81-36.05-18.62,1.78-35.19,7.42-52.17,14.21l-21.92,8.78c1.95,2.61,5.55,6.05,8.65,8.02l10.44,6.64c1.42-1.23,4.47-3.11,6.46-3.83l20.02-7.26c.03,4.05-.62,10.29-1.85,15.09l-2.07,8.06c3.88,1.48,7.36,3.06,11.68,3.72l8.94-31.14c3.56-1.12,9.19-1.52,12.26-1.2,4.51-1.96,8.21-.69,12.71.1,32.56,5.73,10.66,39.41,25.08,81.74,2.55,7.48,11.19,14.96,17.32,18.86l-7.38-19.84c9.01,4.52,15.36,7.83,22.19,10.62,7.65-7.03,14.78-12.43,25.76-20.13l1.17,23.45,13.94,4.57c7.49-22.35,2.56-50.16-18.32-63.36Z" />
          <path className="wallpaper-spider-dark" d="M590.44,470.84l39.11,15.98c11.55,4.72,18.95,15.04,19.05,27.4l.89,105.27c-19.43-4.78-25.01-35.12-29.77-46.15l-1.15-19.42c-.59-9.97-2.19-19.82,2.3-28.24,1.83,13.72,5.68,26.83,11.15,39.78l.56-49.46c.07-6.59-4.24-8.32-7.73-11.24-4.56-3.81-9.59-5.21-15.41-7.76-11.57-5.06-23.21-10.18-33.81-16.92l-7.38-19.84c9.01,4.52,15.36,7.83,22.19,10.62Z" />
          <path className="wallpaper-spider-dark" d="M613,415.36c1.22,6.27,5.05,15.89-.16,20.54-1.57-2.63-5.74-6.16-8.7-7.06l-28.77,22.25c-2.08-4.81-4.56-9.82-2.06-14.51,7.1-3.48,13.33-8.61,19.98-14.51l-13.13-4.06-.23-16.78c15.34-.69,23.44,8.04,33.08,14.14Z" />
          <path className="wallpaper-spider-teal" d="M624.85,504.74c-2.85,5.61-4.86,14.31-3.98,20.92-4.49,8.43-2.9,18.28-2.3,28.24l1.15,19.42c-11.52-26.69-19.61-45.53-10.28-76.34,5.82,2.55,10.85,3.95,15.41,7.76Z" />
        </g>
        <g className="wallpaper-spider-leg" data-leg="R2" style={legOrigin("R2")}>
          <path className="wallpaper-spider-dark" d="M559.65,234.8c-1,3.7-1.41,7.87-1.53,11.94-.31,10.33-.05,21.22.57,32.19,2.32,40.72-28.82,58.63-63.85,67.27l-49,12.09c4.24-9.14,10.38-17.82,17.68-24.46l27.81-6.09c4.41-.97,9.56-3.58,13.77-5.13l10.95-4.03c4.46-1.64,8.92-4.41,11.7-7.84,7.99-5.15,12.84-15.16,12.77-25.61l-.26-44.26c-.13-21.46,12.95-37.51,32.1-46.5l14.32-6.73c4.25-2,11.83-3.66,15.21-6.19,1.76-1.32,6.14-4.49,6.11-7.24-.14-14.67-.65-29.25-1.84-43.14-3.4,8.69-6.46,16.42-8.66,24.08-1.5-9.48-2.63-20.86-1.36-30.72,1.9-14.84,10.46-29.57,23.95-37.2l4.01,85.05c1.89,40.03-73.89,25.95-64.45,62.52Z" />
          <path className="wallpaper-spider-teal" d="M527.75,310.75c-2.78,3.43-7.24,6.2-11.7,7.84l-19.22-25.03-10.44,6.28,18.71,22.79c-4.21,1.55-9.36,4.17-13.77,5.13,0-.54-1.23-4.25-2.19-5.19l-12.08-11.81c-5.51,8.22-10.18,15.61-13.53,23.1-7.3,6.64-13.43,15.32-17.68,24.46-2.65,1.76-6.13,3.53-9.11,4.21-2.58-6.84-5.04-13.89-7.06-21.1,2.24-1,4.48-3.46,6.38-6.14l24.52-34.71c17.87-25.29,41.9-34.34,72.76-33.6l.13,18.93-24.94,1.87,12.57,16.97c1.5,2.02,4.63,4.68,6.65,6Z" />
          <path className="wallpaper-spider-teal" d="M558.12,246.75c.12-4.07.54-8.25,1.53-11.94,6.45-.02,25.77,19.37,29.74,15.73,1.41-1.29,4.98-4.81,3.74-6.09-1.12-1.16-3.88-3.66-5.16-4.57l-21.06-15.05,9.75-7.1,21.41,12.62-1.18-19.74c3.34-2.35,10.64-4.92,15-5.56,12.01,35.02-8.87,69.36-43.8,77.3-2.27-5.99-2.84-12.81-1.78-17.21l10.67-5.34-18.85-13.05Z" />
          <path className="wallpaper-spider-teal" d="M597.5,155.15c-2.17,7.58,2.19,19.17,4.39,26.3-3.38,2.53-10.96,4.2-15.21,6.19l-3.74-21.16,5.67-26.52c1.15-5.36,4.6-11.72,7.52-15.52-1.26,9.85-.13,21.23,1.36,30.72Z" />
        </g>
        <g className="wallpaper-spider-leg" data-leg="R1" style={legOrigin("R1")}>
          <path className="wallpaper-spider-teal" d="M484.35,150.97c-2.84,3.94-4.7,6.57-6.27,11.35-1.79,5.45-.44,6.92,2.19,12.17l5.74,11.44c11.86,23.63,34.55,41.04,25.82,58.41-2.76,5.5-7.57,10.64-14.18,12.35,1.6-38.58-36.61-50.32-39.83-86.56-1.24-13.92,5.77-27.7,14.71-37.9l15.13-17.28c4.32-4.93,7.29-10.94,8.3-16.46,4.74-4.28,4.92-13.99,3.26-20.91,10.75,3.59,21.35,23.19,10.95,37.6l-25.82,35.79Z" />
          <path className="wallpaper-spider-dark" d="M499.21,77.58c1.66,6.92,1.48,16.63-3.26,20.91-9.35-13.19-19.71-25.77-32.83-38.06,2.72,18.55,12.78,29.8,25.07,42.2-2.84,4.47-5.88,8.23-10.13,12.74-7.14-8.18-14.44-14.9-18.8-24.28-9.64-20.71-17.59-41.03-24.7-62.87-2.78-8.54-1.52-19.57,1.28-28.05,22.7,27.08,44.27,51.15,63.37,77.4Z" />
          <path className="wallpaper-spider-dark" d="M486.01,185.93l-5.74-11.44,34.36-.11c.35-3.86.54-8.67.5-11.96l-37.05-.1c1.57-4.78,3.42-7.41,6.27-11.35l27.19-.38-8.69-14.24,11.28-12.19c24.55,27.09,23.26,65.18-.84,91.02l-9.71-14.31,8.1-14.08-25.67-.86Z" />
          <path className="wallpaper-spider-dark" d="M491.97,244.42c-1.4-7.16-4.69-12.18-10.69-18.22l-67.28,73,9.72,21.05,68.24-75.83Z" />
        </g>
        <g className="wallpaper-spider-leg" data-leg="L4" style={legOrigin("L4")}>
          <path className="wallpaper-spider-dark" d="M192.91,451.72l-28.08,11.1c-4.5,1.78-9.38,5.05-13.48,7.68-3.26,2.08-6.67,4.37-10.21,6.9l27.19,25.18c-3.1,3.36-5.37,3.78-9.55,5.81l-26.14-21.83c-8.87,8.59-8.35,21.26-1.07,30.49l24.25,30.73c27.36,34.67,3.96,65.31-15.79,93.88-6.1,8.83-6.27,17.59-.03,26.49l28.52,40.69c-2.39-15.02-6.79-26.63-11.21-38.95,10.95,9.91,19.2,22.93,26,36.43,4.14,8.22,4.79,19.59,7.17,29.03,2.95,11.7,2.18,23.43-6.46,32.44l-62.14-92.26c-9.51-14.12-8.32-28.89.42-42.72l20.9-33.08c-14.32-.37-24.79.39-35.21-3.95-1.29-2.53-.22-6.66-.56-9l40.53.67c-.13-5.59-.2-9.38-1.03-12.43-1.23-4.51-3.98-9.13-6.8-12.92l-24.34-32.73c-13.46-18.1-12.63-40.93,2.77-57.9,11.25-12.4,26.03-21.04,41.74-27.8l42.29-18.2c-.68,9.24-6.92,17.75-9.69,26.27Z" />
          <path className="wallpaper-spider-teal" d="M224.07,415.01c6.48,2.44,11.48,8.74,13.25,15.44-4.82,2.13-15.51,5.4-17.64,11.04l-19.35,51.2c-7.83,20.73-24.61,35.49-46.77,39.35-4.83-4.22-9.42-10.29-12.38-15.1l17.59-8.57c4.17-2.03,6.45-2.45,9.55-5.81l8.76-9.5c-9.02-9.07-16.42-15.98-25.74-22.57,4.1-2.62,8.98-5.89,13.48-7.68,4.7,6.5,10.75,10.99,19.08,16.57l8.99-27.68c2.77-8.52,9.01-17.03,9.69-26.27,7.2-3.1,13.97-8.47,21.48-10.44Z" />
          <path className="wallpaper-spider-teal" d="M140.14,562.08c2.82,3.79,5.57,8.41,6.8,12.92l-41.18.13,1.68,11.63c.34,2.34-.73,6.47.56,9,3.78,7.4,9.15,13.97,15.27,21.01l-11.25,16.32c-14.79-12.71-23.91-28.01-25.24-46.44-1.53-21.27,5.77-40.76,22.53-53.45l11.09,15.35-9.91,12.82,29.64.71Z" />
          <path className="wallpaper-spider-teal" d="M183.31,706.31c-6.8-13.5-15.05-26.52-26-36.43-4.42-4-8.86-10.19-12.95-15.76-.2-5.06,5.5-13.52,10.43-15.14,18.03,12.4,21.49,30.99,26.81,50.73,1.57,5.83,2.3,11.33,1.72,16.59Z" />
        </g>
        <g className="wallpaper-spider-leg" data-leg="L3" style={legOrigin("L3")}>
          <path className="wallpaper-spider-dark" d="M183.65,396.42c-6.7,4.27-13.15,9.04-20.57,11.76-4.55,1.67-8.76,2.98-13.58,3.48-3.34.34-7.81.6-11.86.63l-8.99-32.57c-3.34-2.38-8.35-3.01-11.25-.32l6.88,30.65-18.92-5.22-1.28,18.43c49.02,18.86,66.42,4.1,108.96-21.48l-8.52-20.1c-6.08,5.89-13.54,10.07-20.86,14.74Z" />
          <path className="wallpaper-spider-teal" d="M204.51,381.68c-6.08,5.89-13.54,10.07-20.86,14.74-2.25-1.93-6.08-4.16-9.35-5.36l-17.51-6.42c.86,8.92,2.45,17.1,6.29,23.53-4.55,1.67-8.76,2.98-13.58,3.48l-8.21-31.54c-4.56-.54-9.21-.77-12.64-.4-3.34-2.38-8.35-3.01-11.25-.32-35.38,4.32-10.93,45.91-27.73,84.13-3.61,8.22-9.97,12.37-16.39,16.5-1.42-8.39,5.26-7.38,8.49-20.42-8.82,4.54-15.47,8.06-23.35,11.26l-25.84-20.86c-.79,8.86-.32,14.67.43,23.27-3.86,2.13-9.69,4.2-15.24,5.66-7.94-24.03-1.3-49.58,18.14-63.58l-2.48,14.91c-.15.88.47,5.04,1.24,4.96l2.46-.23c7.79,10.31,19.81,17.43,30.95,26.32,3.43-1.8,5.79-6.59,5.53-10.08,1.41-1.03,4.13-3.62,4.97-5.25.97-1.9-1.31-6.27-2.95-7.63,3.29-3.31,1.34-30.63,2.29-43.57,1.39-18.77,17.53-31.31,35.05-35.14,19.84-4.34,39.6,1.94,58.4,9.21l33.14,12.82Z" />
          <path className="wallpaper-spider-dark" d="M73.28,480.03c-5.58,3.6-11.18,7.17-17.86,10.1l-16,7.03c-4.48,1.97-9.36,3.3-13.76,5.78-3.84,2.16-8.46,5.53-8.43,11.52l.2,51.23c5.17-12.34,9.33-24.99,11.08-38.13,2.2,4.82,3.76,12.74,3.09,18.87l-3.35,30.7-7.55,21.28c-3.54,9.96-10.27,18.35-20.69,20.89l.49-101.21c.07-15.38,7.17-26.55,21.55-32.4l36.38-14.81c7.88-3.21,14.53-6.72,23.35-11.26-3.23,13.04-9.91,12.03-8.49,20.42Z" />
          <path className="wallpaper-spider-dark" d="M75.63,438.37c1.64,1.36,3.92,5.73,2.95,7.63-.83,1.63-3.55,4.23-4.97,5.25l-28.55-23.1c-2.73,1.85-6.06,4.76-7.93,6.86l-2.46.23c-.77.07-1.38-4.09-1.24-4.96l2.48-14.91c10.11-7.28,20.28-14.26,34.09-14l-.94,16.43-13.02,4.3,19.59,16.27Z" />
          <path className="wallpaper-spider-teal" d="M39.42,497.16c4.85,6.33,4.41,27.24,3.49,36.13-1.66,16.04-9.73,29.92-14.67,43.84l3.35-30.7c.67-6.13-.89-14.05-3.09-18.87,1.01-7.6-1.67-17.03-2.84-24.62,4.41-2.48,9.28-3.81,13.76-5.78Z" />
        </g>
        <g className="wallpaper-spider-leg" data-leg="L2" style={legOrigin("L2")}>
          <path className="wallpaper-spider-dark" d="M52.81,122.83l-.06,29.85c0,1.27-1.87,4.87-1.95,4.37-.77-8.3-3.64-16.45-7.89-25.01l-1.91,40.62c-.17,3.7,4.21,8.39,7.53,8.85,3.79,3.29,8.68,5.46,13.65,6.14l19.59,9.18c18.11,8.49,27.7,25.77,27.47,45.73l-.48,41.85c-.13,11.18,5.09,22.1,14.05,26.67,2.72,2.71,6.35,5.23,9.97,6.94,4.05,1.92,8.47,3.54,12.75,4.79,3.8,1.81,7.92,3.04,12.13,4.32,9.65,2.94,19.51,5.63,29.43,6.95,5.22,8.03,12.86,15.12,15.84,24.54l-53.28-13.83c-28.04-7.28-58.79-25.17-58.74-58.51l.05-36.41c1.49-4.81,1.53-10.42-.24-15.05.24-5.86-1.19-17.54-7.96-20.37l-41.52-17.39c-13.23-5.54-16.21-16.68-15.63-29.41l3.65-80.44c14.51,7.84,20.74,21.75,23.55,35.64Z" />
          <path className="wallpaper-spider-teal" d="M219.46,341.71l-7.01,22.26-9.51-5.36c-2.98-9.42-10.62-16.51-15.84-24.54l-15.11-23.24c-6.24,5.8-10.17,10.35-14.32,16.3-4.21-1.28-8.33-2.51-12.13-4.32l16.67-23.05-9.3-6.08-20.12,24.34c-3.62-1.71-7.25-4.24-9.97-6.94l18.16-22.83-24.14-2.57c-1.68-3.87-1.68-11.75-.48-18.05,50.66-4.12,70.77,27.19,94.52,65.59,2.21,3.56,5.78,7.14,8.58,8.5Z" />
          <path className="wallpaper-spider-teal" d="M90.73,234.81c1.77,4.62,1.73,10.23.24,15.05l-18.92,9.63,12.12,7.34-1.57,16.71c-35.18-11.35-55.94-38.09-46.2-75.68,2.28-3.59,15.69-.89,15.47,3.74l-.91,18.68,19.94-11.42c2.8-1.6,9.96,2.75,11.68,7.02l-21.85,13.72c-1.88,1.18-4.29,4.89-4.25,6.92.3,15.22,30.25-14.22,34.24-11.7Z" />
          <path className="wallpaper-spider-teal" d="M62.19,187.64c-4.97-.68-9.87-2.85-13.65-6.14,1.46-7.93,3.01-16.47,2.27-24.45.08.5,1.95-3.1,1.95-4.37l.06-29.85c6.97,12.7,11.72,27.96,12.91,43.79.48,6.41-3,15.07-3.53,21.01Z" />
        </g>
        <g className="wallpaper-spider-leg" data-leg="L1" style={legOrigin("L1")}>
          <path className="wallpaper-spider-dark" d="M175.51,233.89c-3.62-3.93-7.76-7.44-11.32-10.42-2.29,5.11-12.66,11.49-8.98,19.16l70.63,77.81,10.07-20.87-60.4-65.69Z" />
          <path className="wallpaper-spider-teal" d="M153.58,99.67c6.84,22.03,31.6,31.76,37.37,59.67,5.99,28.94-22.35,49.33-26.76,64.13-2.29,5.11-12.66,11.49-8.98,19.16l-5.36,14.69c-6.03-3.68-12.56-11.91-13.5-18-1.26-8.18,2.01-16.1,6.48-22.55l21.36-30.81c2.6-3.76,4.58-8.03,6.34-12.08,1.63-3.75,1.78-7.76-.12-11.14,2.71-4.6-1.71-8.99-5.84-11.69-8.18-19.2-35.91-35.09-28.68-59.04,1.63-5.39,9.92-9.3,13.56-14.08-1.45,8.23,2.01,14.93,4.13,21.74Z" />
          <path className="wallpaper-spider-dark" d="M153.58,99.67c-2.12-6.81-5.57-13.51-4.13-21.74C169.57,51.53,190.85,26.53,213.94,0c2.35,10.48,3.32,20.93.23,30.13-8.46,25.18-22.39,69.33-42.83,84.54l-9.84-11.01c10.86-12.95,21.17-23.59,23.83-41.04-8.13,3.86-29.69,32.03-31.75,37.06Z" />
          <path className="wallpaper-spider-dark" d="M164.56,151.06c4.14,2.7,8.56,7.09,5.84,11.69l-36.11-.48v12.38s36.23-.77,36.23-.77c-1.76,4.05-3.74,8.32-6.34,12.08l-25.8.55,7.23,15.2-10.5,12.77c-23.77-27.13-23.37-64.83.42-90.18l10.56,11.81-7.51,14.1,25.98.84Z" />
        </g>
        <g className="wallpaper-spider-body">
          <path className="wallpaper-spider-dark" d="M407.74,433.74l4.05-4.83c1.13-6.19,8.42-9.4,11.69-13.85l10.85-14.78,1.52.91,8.25-20.87c-5.27-3.44-5.16-11.96-7.36-17.79-2.58-6.84-5.04-13.89-7.06-21.1l-5.95-21.17-9.72-21.05-15.73-10.93,14.72-19.77c11.07-14.87,17.07-33.35,14.81-52.14-9.1-75.72-39.8-111.62-103.19-150.93-40.17,25.23-75.88,53.24-91.06,98.99-9.32,28.08-18.78,63.7-5.22,90.76,6.07,12.12,14.41,22.03,22.66,32.81l-15.09,11.59-10.07,20.87-6.38,21.25-7.01,22.26c-2.2,6.98-2.85,12.79-7.93,17.71l8.52,20.1,11.04,13.23c6.48,2.44,11.48,8.74,13.25,15.44l4.3,2.17c4.69,2.37-23.01,29.39-28.03,42.39-5.45,14.11-3.86,31.26-5.12,47.07-.39,4.89,18.63,48.71,30.34,53.42-.46-14.84-1.39-29.35-3.33-43.11-.44-3.12-6.09-9.52-5.85-12.68,3.09-39.8-2.58-29.97,23.59-60.91,1.32,12.04-.7,24.64,4.1,35.53,8.4,19.06,23.58,31.87,43.2,41.76l-1.45-24.12c-.79-13.06,14.91-18.42,25.69-32.21,8.04,11.55,26.09,20.48,25.73,30.05l-.98,25.77c34.03-18.91,47.43-34.08,46.68-75.8,26.63,29.33,19.98,21.83,23.93,60.24-1.3,3.63-5.75,10.59-6.54,14.09-2.07,13.75-2.83,27.74-2.57,41.49,11.8-7.56,28.14-42.94,29.15-52.66,1.58-15.19.14-34.13-4.72-48.27-3.77-10.96-29.91-38.31-27.71-40.94ZM243.33,225.59c1.15-22.14,6.9-42.25,13.88-63,14.73-31.51,38.44-51.46,67.41-71.09,23.57,16,44.82,33.13,59.81,57.1,11.68,18.69,15.71,40.08,20.15,61.58,6.35,30.79-7.83,44.56-27.08,66.63l-106.2-.05c-11.14-13.76-28.93-32.61-27.96-51.16ZM311.93,434.67c-2.03,15.85-7.76,33.48-15.36,47.47-4.34,7.98-9.43,13.12-10.81,23.78-8.53-7.5-14.59-18.83-14.45-31.49.16-14.3-.56-28.85,1.09-42.37,1.13-9.25,13.92-11.91,20.44-11.77,6.5.14,20.28,5.14,19.09,14.38ZM377.91,476.33c-.19,11.4-6.36,21.82-14.35,30.2-.87-10.59-6.59-15.99-11.09-24.54-7.37-14.03-12.96-31.53-15.26-47.38-1.33-9.15,12.46-14.12,18.83-14.23,6.9-.11,20.15,2.95,21.01,12.5,1.3,14.34,1.11,28.78.86,43.45ZM391.39,418.56c-18.96-20.13-48.11-21.8-66.53-.66-18.3-19.68-48.09-20.89-66.62.69l-28.04-34.08,15.77-53.23c5.31.64,14.69-1.61,15.63-6.01l-4.47-14.54c6.38-4.68,15.47-12.58,23.37-12.61l87.67-.32c8.55-.03,17.76,8.62,24.61,12.83l-5.04,14.31c1.97,4.5,8.54,7.17,15.77,6.71l15.82,52.34-27.93,34.59Z" />
          <path className="wallpaper-spider-pale" d="M271.29,276.75c-11.14-13.76-28.93-32.61-27.96-51.16,1.15-22.14,6.9-42.25,13.88-63,14.73-31.51,38.44-51.46,67.41-71.09,23.57,16,44.82,33.13,59.81,57.1,11.68,18.69,15.71,40.08,20.15,61.58,6.35,30.79-7.83,44.56-27.08,66.63l-106.2-.05Z" />
          <path className="wallpaper-spider-pale" d="M403.51,331.62c-7.23.46-13.8-2.21-15.77-6.71l5.04-14.31c-6.84-4.21-16.06-12.86-24.61-12.83l-87.67.32c-7.9.03-16.99,7.93-23.37,12.61l4.47,14.54c-.93,4.4-10.32,6.65-15.63,6.01l-15.77,53.23,28.04,34.08c18.54-21.58,48.32-20.36,66.62-.69,18.42-21.13,47.57-19.46,66.53.66l27.93-34.59-15.82-52.34ZM261.59,363.47c-6.02,0-10.9-4.88-10.9-10.9s4.88-10.9,10.9-10.9,10.9,4.88,10.9,10.9-4.88,10.9-10.9,10.9ZM300.11,389.28c-11.44,0-20.71-9.27-20.71-20.71s9.27-20.71,20.71-20.71,20.71,9.27,20.71,20.71-9.27,20.71-20.71,20.71ZM349.17,389.16c-11.43,0-20.69-9.26-20.69-20.69s9.26-20.69,20.69-20.69,20.69,9.26,20.69,20.69-9.26,20.69-20.69,20.69ZM387.49,363.36c-6.02,0-10.9-4.88-10.9-10.9s4.88-10.9,10.9-10.9,10.9,4.88,10.9,10.9-4.88,10.9-10.9,10.9Z" />
          <path className="wallpaper-spider-pale" d="M285.76,505.92c-8.53-7.5-14.59-18.83-14.45-31.49.16-14.3-.56-28.85,1.09-42.37,1.13-9.25,13.92-11.91,20.44-11.77,6.5.14,20.28,5.14,19.09,14.38-2.03,15.85-7.76,33.48-15.36,47.47-4.34,7.98-9.43,13.12-10.81,23.78Z" />
          <path className="wallpaper-spider-pale" d="M363.56,506.53c-.87-10.59-6.59-15.99-11.09-24.54-7.37-14.03-12.96-31.53-15.26-47.38-1.33-9.15,12.46-14.12,18.83-14.23,6.9-.11,20.15,2.95,21.01,12.5,1.3,14.34,1.11,28.78.86,43.45-.19,11.4-6.36,21.82-14.35,30.2Z" />
          <circle className="wallpaper-spider-dark" cx="349.17" cy="368.47" r="20.69" />
          <circle className="wallpaper-spider-dark" cx="300.11" cy="368.57" r="20.71" />
          <circle className="wallpaper-spider-dark" cx="261.59" cy="352.57" r="10.9" />
          <circle className="wallpaper-spider-dark" cx="387.49" cy="352.46" r="10.9" />
        </g>
      </svg>
    </div>
  </>;
}
