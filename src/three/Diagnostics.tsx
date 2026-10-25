import { useThree } from "@react-three/fiber";
import type React from "react";
import { useLayoutEffect } from "react";

// With the diagnostics prop, logs the renderer's counts after each render so
// scripts/render-checks.mjs can check the draw-call and triangle budgets (spec RN6).
export const Diagnostics: React.FC<{ ve: number }> = ({ ve }) => {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    scene.onAfterRender = (renderer) => {
      const { calls, triangles } = renderer.info.render;
      console.log(`THREE_STATS ${JSON.stringify({ calls, triangles, ve })}`);
    };
    return () => {
      scene.onAfterRender = () => undefined;
    };
  }, [scene, ve]);
  return null;
};
