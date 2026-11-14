/**
 * The room the phone stands in, as reflections: a bone-coloured studio with a large soft key, a hard strip
 * to either side for the frame's edges and the glass, and the floor's bounce. It is neutral: the prism is the
 * two rim lights on the stage, whose colour follows the place along the bridge. Drawn once into a small cube
 * map; nothing is downloaded.
 */
import * as THREE from "three";

export function buildRoom(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#8f8b84");
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials: THREE.Material[] = [];
  const panel = (colour: string, strength: number, at: [number, number, number], size: [number, number]) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(strength), side: THREE.DoubleSide, toneMapped: false });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...at);
    mesh.scale.set(size[0], size[1], 1);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };
  panel("#ffffff", 5.5, [-5, 6, 6], [8, 8]); // key: high, front, left
  panel("#fff6ea", 0.9, [4, 0, 9], [7, 9]); // what the glass mirrors, seen head-on
  panel("#ffffff", 10, [8, 1.5, 1.5], [1.0, 12]); // a strip: the light that crosses the glass as the phone turns
  panel("#ffffff", 6, [-8, 1, -1], [1.0, 12]); // and one for the frame's other edge
  panel("#ffffff", 4, [0, 8, -3], [10, 3]); // top, behind
  panel("#f4ece0", 2.2, [0, -7, 2.5], [10, 4]); // the floor's own bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0.035).texture;
  pmrem.dispose();
  geometry.dispose();
  materials.forEach((m) => m.dispose());
  return texture;
}
