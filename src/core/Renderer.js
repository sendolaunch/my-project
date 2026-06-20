import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';

// Three.js setup for the isometric look (§9 tech stack). An orthographic camera
// placed at equal (d,d,d) gives the true 35.26° isometric angle. Iso is
// deliberately lighter than free-roam 3D (§14) — we lean into that.

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(PALETTE.voidBlack, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Cap DPR — retina phones otherwise render 3–4x the pixels for no benefit
    // and tank the framerate (§14: test on a phone browser, build lean).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(PALETTE.voidBlack, 28, 52);

    this.viewSize = 13;             // half-height of the ortho frustum, in world units
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const d = 40;
    this.camera.position.set(d, d, d);
    this.camera.lookAt(0, 0, 0);

    this._addLights();
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  _addLights() {
    // Cool ambient + a single warm key with shadows = cohesive mood on cheap
    // geometry (§14: consistent lighting is what sells the look).
    this.scene.add(new THREE.AmbientLight(PALETTE.ash, 0.55));
    const key = new THREE.DirectionalLight(PALETTE.bone, 1.1);
    key.position.set(12, 22, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -16; key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;   key.shadow.camera.bottom = -16;
    key.shadow.camera.near = 1;   key.shadow.camera.far = 80;
    this.scene.add(key);
    // Faint plague-green fill from below the breach for atmosphere.
    const fill = new THREE.DirectionalLight(PALETTE.plagueGreen, 0.25);
    fill.position.set(-10, 4, -10);
    this.scene.add(fill);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    const v = this.viewSize;
    this.camera.left = -v * aspect;
    this.camera.right = v * aspect;
    this.camera.top = v;
    this.camera.bottom = -v;
    this.camera.updateProjectionMatrix();
  }

  /** Project a pointer (NDC -1..1) onto the ground plane → world Vector3, or null. */
  pointerToGround(ndcX, ndcY) {
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this._groundPlane, hit) ? hit : null;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
