// Photoreal layer: the textures and sky image, loaded outside the canvas behind the load gate (docs/adr/0054-photoreal-layer.md,
// docs/adr/0043-load-gate-for-providers.md) and handed to the views as props (ADR 4).
import React, { createContext, useContext } from "react";
import { staticFile } from "remotion";
import * as THREE from "three";
import { TextureLoader } from "three";
import { SKY_IMAGE, standInTextures, TEXTURE_ROLE_NAMES, TEXTURE_ROLES, type PhotoTextures, type RoleTextures } from "../three/photo/assetRoles";
import { AssetLoadError, useLoadGate } from "./loadGate";

// Only this file may use a texture loader (static test CL14 as amended by ADR 54): each path it loads comes from the
// role table, whose files are registered with their licence in data/assets-3d.json. A role without a file renders
// with a procedural stand-in, so a missing download never silently changes a sourced feature: it changes a material.

export type PhotoAssets = { textures: PhotoTextures; sky: THREE.Texture | null };

const Ctx = createContext<PhotoAssets | null>(null);

async function loadTexture(path: string, srgb: boolean, section: string, signal: AbortSignal): Promise<THREE.Texture> {
  // fetch first, so a missing file fails with its path and section (RD5) and the abort signal is honoured
  const r = await fetch(staticFile(path), { signal });
  if (!r.ok) throw new AssetLoadError(section, path, `HTTP ${r.status}`);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  try {
    const t = await new TextureLoader().loadAsync(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  } catch (e) {
    throw new AssetLoadError(section, path, (e as Error).message || "failed to decode");
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadPhotoAssets(section: string, signal: AbortSignal): Promise<PhotoAssets> {
  const textures = {} as PhotoTextures;
  await Promise.all(
    TEXTURE_ROLE_NAMES.map(async (role) => {
      const files = TEXTURE_ROLES[role];
      if (!files) {
        textures[role] = standInTextures(role);
        return;
      }
      const [map, normalMap] = await Promise.all([loadTexture(files.map, true, section, signal), files.normalMap ? loadTexture(files.normalMap, false, section, signal) : Promise.resolve(standInTextures(role).normalMap)]);
      const role3: RoleTextures = { map, normalMap, tileM: files.tileM };
      textures[role] = role3;
    }),
  );
  let sky: THREE.Texture | null = null;
  if (SKY_IMAGE) {
    sky = await loadTexture(SKY_IMAGE.file, true, section, signal);
    sky.mapping = THREE.EquirectangularReflectionMapping;
  }
  return { textures, sky };
}

export const PhotoAssetsProvider: React.FC<{ section: string; children: React.ReactNode }> = ({ section, children }) => {
  const key = `photo-assets|${Object.keys(TEXTURE_ROLES).length}|${SKY_IMAGE?.file ?? "dome"}`;
  const assets = useLoadGate(() => `Loading the photoreal textures for ${section}`, key, (signal) => loadPhotoAssets(section, signal));
  if (!assets) return null;
  return <Ctx.Provider value={assets}>{children}</Ctx.Provider>;
};

export function usePhotoAssets(): PhotoAssets {
  const a = useContext(Ctx);
  if (!a) throw new Error("usePhotoAssets() must be used inside <PhotoAssetsProvider>");
  return a;
}
