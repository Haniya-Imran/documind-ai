"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Float } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function spineTexture(title: string, color: string, pages: number) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = color; g.fillRect(0, 0, 128, 1024);
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, "rgba(0,0,0,.35)"); grad.addColorStop(.15, "rgba(255,255,255,.08)"); grad.addColorStop(.85, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,.3)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 1024);
  g.fillStyle = "#E8A33D"; g.fillRect(0, 70, 128, 8); g.fillRect(0, 946, 128, 8);
  g.save(); g.translate(64, 512); g.rotate(-Math.PI / 2);
  g.fillStyle = "#FFF6E6"; g.font = "bold 46px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  const words = title.toUpperCase();
  g.fillText(words.length > 22 ? words.slice(0, 21) + "…" : words, 0, -6);
  g.font = "26px Arial, sans-serif"; g.fillStyle = "rgba(255,246,230,.75)"; g.fillText(`${pages} PAGES · DOCUMIND`, 0, 36);
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function coverTexture(title: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 720;
  const g = c.getContext("2d")!;
  g.fillStyle = color; g.fillRect(0, 0, 512, 720);
  g.fillStyle = "rgba(255,255,255,.08)"; for (let i = 0; i < 12; i++) g.fillRect(0, i * 60, 512, 2);
  g.fillStyle = "#E8A33D"; g.fillRect(48, 90, 90, 12);
  g.fillStyle = "#FFF6E6"; g.font = "bold 62px Arial, sans-serif"; g.textBaseline = "top";
  const words = title.split(" "); let line = "", y = 130;
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > 420) { g.fillText(line, 48, y); y += 72; line = w; } else line = t; }
  g.fillText(line, 48, y);
  g.font = "28px Arial, sans-serif"; g.fillStyle = "rgba(255,246,230,.8)"; g.fillText("OpenStax · DocuMind library", 48, 640);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function Book({ i, x, title, color, pages, selected, onSelect }: { i: number; x: number; title: string; color: string; pages: number; selected: boolean; onSelect: (i: number) => void }) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const h = 2.6 + (pages - 90) / 60, w = 0.42 + pages / 900, d = 1.9;
  const mats = useMemo(() => {
    const spine = spineTexture(title, color, pages), cover = coverTexture(title, color);
    const paper = new THREE.MeshStandardMaterial({ color: "#F3EAD8", roughness: .9 });
    const base = new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .05 });
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z. Spine faces the viewer (+z); the cover is on +x
    // so it turns toward the camera when a book is pulled out.
    return [
      new THREE.MeshStandardMaterial({ map: cover, roughness: .55 }),
      base, paper, base,
      new THREE.MeshStandardMaterial({ map: spine, roughness: .5 }),
      paper,
    ];
  }, [title, color, pages]);
  useEffect(() => { document.body.style.cursor = hover ? "pointer" : ""; return () => { document.body.style.cursor = ""; }; }, [hover]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    // pulled-out book comes forward a little and turns its cover to the viewer, staying inside the frame
    const tz = selected ? 0.95 : hover ? 0.3 : 0;
    const ty = selected ? 0.22 : 0;
    const ry = selected ? -Math.PI / 3.4 : 0;
    const tx = selected ? x * 0.55 : x;
    const k = 1 - Math.exp(-dt * 6);
    ref.current.position.z += (tz - ref.current.position.z) * k;
    ref.current.position.x += (tx - ref.current.position.x) * k;
    ref.current.position.y += (h / 2 + ty - ref.current.position.y) * k;
    ref.current.rotation.y += (ry - ref.current.rotation.y) * k;
  });
  return (
    <group ref={ref} position={[x, h / 2, 0]}>
      <mesh castShadow receiveShadow material={mats}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }} onPointerOut={() => setHover(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(i); }}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
    </group>
  );
}

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 260, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * 12; p[i * 3 + 1] = Math.random() * 7; p[i * 3 + 2] = (Math.random() - .5) * 6 - 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); return g;
  }, []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const a = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * .25; if (y > 7) y = 0; a.setY(i, y); }
    a.needsUpdate = true;
  });
  return <points ref={ref} geometry={geo}><pointsMaterial size={0.05} color="#FFD48A" transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} /></points>;
}

function Rig() {
  const { camera, size } = useThree();
  useEffect(() => { camera.position.set(0, 3.2, size.width < 640 ? 12.5 : 9.8); camera.lookAt(0, 1.5, 0); }, [camera, size.width]);
  return null;
}

export function Shelf3D({ selected, onSelect, colors, titles, pages }: { selected: number; onSelect: (i: number) => void; colors: string[]; titles: string[]; pages: number[] }) {
  const xs = useMemo(() => {
    const widths = pages.map((p) => 0.42 + p / 900);
    const gap = 0.12; const total = widths.reduce((s, w) => s + w, 0) + gap * (widths.length - 1);
    let x = -total / 2; return widths.map((w) => { const c = x + w / 2; x += w + gap; return c; });
  }, [pages]);
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 38, position: [0, 3.2, 9.8] }} aria-label="Interactive 3D bookshelf of the five built-in books">
      <Rig />
      <color attach="background" args={["#1C1712"]} />
      <fog attach="fog" args={["#1C1712", 10, 20]} />
      <ambientLight intensity={0.5} />
      <spotLight position={[3, 8, 6]} angle={0.5} penumbra={0.8} intensity={70} castShadow color="#FFE2B0" />
      <pointLight position={[-4, 3, 3]} intensity={18} color="#E8A33D" />
      <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.25}>
        <group position={[0, 0, 0]}>
          {titles.map((t, i) => <Book key={t} i={i} x={xs[i]} title={t} color={colors[i]} pages={pages[i]} selected={selected === i} onSelect={onSelect} />)}
          <mesh position={[0, -0.08, 0]} receiveShadow castShadow>
            <boxGeometry args={[6.4, 0.16, 2.4]} />
            <meshStandardMaterial color="#6B4A2E" roughness={0.7} />
          </mesh>
        </group>
      </Float>
      <ContactShadows position={[0, -0.3, 0]} opacity={0.55} scale={14} blur={2.6} far={4} />
      <Particles />
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 2.05} minAzimuthAngle={-Math.PI / 4} maxAzimuthAngle={Math.PI / 4} target={[0, 1.5, 0]} autoRotate autoRotateSpeed={0.35} />
    </Canvas>
  );
}
