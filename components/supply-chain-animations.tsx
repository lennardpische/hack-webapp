"use client";

import { useEffect, useRef } from "react";

type BackdropProps = {
  active?: boolean;
  theme?: "light" | "dark";
};

type ToolState = "input-available" | "output-available" | "output-error" | string;

const ROUTE_NODES = [
  { x: 0.08, y: 0.22, layer: 0 },
  { x: 0.22, y: 0.12, layer: 1 },
  { x: 0.36, y: 0.28, layer: 2 },
  { x: 0.52, y: 0.18, layer: 0 },
  { x: 0.72, y: 0.26, layer: 1 },
  { x: 0.9, y: 0.14, layer: 2 },
  { x: 0.14, y: 0.58, layer: 2 },
  { x: 0.3, y: 0.72, layer: 0 },
  { x: 0.46, y: 0.52, layer: 1 },
  { x: 0.64, y: 0.68, layer: 2 },
  { x: 0.82, y: 0.56, layer: 0 },
  { x: 0.94, y: 0.78, layer: 1 },
];

const ROUTES = [
  [0, 1, 2, 4, 5],
  [6, 7, 8, 10, 11],
  [1, 8, 9, 10],
  [2, 3, 4, 10],
  [0, 6, 8, 3, 5],
];

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: "light" | "dark",
) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = theme === "light" ? "rgba(23,32,42,0.07)" : "rgba(255,255,255,0.045)";

  for (let x = -height; x < width + height; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.42, height);
    ctx.stroke();
  }

  ctx.strokeStyle = theme === "light" ? "rgba(232,90,42,0.11)" : "rgba(255,92,40,0.07)";
  for (let y = 24; y < height; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + Math.sin(y) * 8);
    ctx.stroke();
  }

  ctx.restore();
}

function nodePosition(
  node: (typeof ROUTE_NODES)[number],
  width: number,
  height: number,
  time: number,
) {
  return {
    x: node.x * width + Math.sin(time * 0.00055 + node.layer) * 10,
    y: node.y * height + Math.cos(time * 0.00048 + node.layer * 1.7) * 8,
  };
}

function drawRoutes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  theme: "light" | "dark",
) {
  const positions = ROUTE_NODES.map((node) => nodePosition(node, width, height, time));
  const orangeLine = theme === "light" ? "rgba(232,90,42,0.32)" : "rgba(255,92,40,0.28)";
  const greenLine = theme === "light" ? "rgba(13,148,136,0.24)" : "rgba(74,222,128,0.2)";
  const orangePacket = theme === "light" ? "rgba(232,90,42,0.92)" : "rgba(255,92,40,0.92)";
  const greenPacket = theme === "light" ? "rgba(13,148,136,0.82)" : "rgba(74,222,128,0.82)";

  ROUTES.forEach((route, routeIndex) => {
    ctx.save();
    ctx.lineWidth = routeIndex % 2 === 0 ? 1.4 : 1;
    ctx.strokeStyle = routeIndex % 2 === 0 ? orangeLine : greenLine;
    ctx.beginPath();

    route.forEach((nodeIndex, index) => {
      const point = positions[nodeIndex];
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        const previous = positions[route[index - 1]];
        const controlX = (previous.x + point.x) / 2;
        const controlY =
          (previous.y + point.y) / 2 + Math.sin(time * 0.00035 + routeIndex) * 26;
        ctx.quadraticCurveTo(controlX, controlY, point.x, point.y);
      }
    });

    ctx.stroke();
    ctx.restore();
  });

  ROUTES.forEach((route, routeIndex) => {
    const segment = Math.floor((time * 0.001 + routeIndex * 1.3) % (route.length - 1));
    const progress = (time * 0.001 + routeIndex * 1.3) % 1;
    const start = positions[route[segment]];
    const end = positions[route[segment + 1]];
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(end.y - start.y, end.x - start.x));
    ctx.fillStyle = routeIndex % 2 === 0 ? orangePacket : greenPacket;
    ctx.fillRect(-5, -2, 10, 4);
    ctx.restore();
  });

  positions.forEach((point, index) => {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.strokeStyle =
      index % 3 === 0
        ? theme === "light"
          ? "rgba(23,32,42,0.32)"
          : "rgba(255,255,255,0.4)"
        : theme === "light"
          ? "rgba(232,90,42,0.42)"
          : "rgba(255,92,40,0.38)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-4, -4, 8, 8);
    ctx.fillStyle = theme === "light" ? "rgba(255,255,255,0.82)" : "rgba(10,10,10,0.8)";
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  });
}

export function SupplyChainBackdrop({ active = true, theme = "light" }: BackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const canvasContext = canvasElement.getContext("2d");
    if (!canvasContext) return;

    const canvas = canvasElement;
    const ctx = canvasContext;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let width = 0;
    let height = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function render(time: number) {
      ctx.clearRect(0, 0, width, height);
      drawGrid(ctx, width, height, theme);
      drawRoutes(ctx, width, height, time, theme);

      if (!reducedMotion && active) {
        animationFrame = requestAnimationFrame(render);
      }
    }

    resize();
    render(0);
    window.addEventListener("resize", resize);

    if (!reducedMotion && active) {
      animationFrame = requestAnimationFrame(render);
    }

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, [active, theme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-70"
    />
  );
}

export function ExceptionCommandVisual() {
  return (
    <div aria-hidden="true" className="exception-command-visual">
      <div className="exception-command-visual__grid" />
      <div className="exception-command-visual__route route-a" />
      <div className="exception-command-visual__route route-b" />
      <div className="exception-command-visual__route route-c" />
      <div className="exception-command-visual__node node-a" />
      <div className="exception-command-visual__node node-b" />
      <div className="exception-command-visual__node node-c" />
      <div className="exception-command-visual__node node-d" />
      <div className="exception-command-visual__packet packet-a" />
      <div className="exception-command-visual__packet packet-b" />
      <div className="exception-command-visual__packet packet-c" />
      <div className="exception-command-visual__panel panel-a">
        <span />
        <span />
        <span />
      </div>
      <div className="exception-command-visual__panel panel-b">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function toolSignalName(toolName: string) {
  if (toolName.includes("Shipment")) return "terminal scan";
  if (toolName.includes("Exceptions")) return "risk queue";
  if (toolName.includes("Slots")) return "capacity map";
  if (toolName.includes("reschedule")) return "route commit";
  if (toolName.includes("resolve")) return "case close";
  if (toolName.includes("Communication")) return "message draft";
  return "agent tool";
}

export function ToolCallAnimation({
  toolName,
  state,
}: {
  toolName: string;
  state: ToolState;
}) {
  const complete = state === "output-available";
  const failed = state === "output-error";

  return (
    <div
      aria-hidden="true"
      className={`tool-call-animation ${complete ? "is-complete" : ""} ${
        failed ? "is-failed" : ""
      }`}
    >
      <div className="tool-call-animation__header">
        <span>{toolSignalName(toolName)}</span>
        <span>{complete ? "locked" : failed ? "blocked" : "routing"}</span>
      </div>
      <div className="tool-call-animation__lanes">
        <span />
        <span />
        <span />
      </div>
      <div className="tool-call-animation__matrix">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
