import * as THREE from 'three';
import { GRID, PATH_WAYPOINTS } from '../config/gameConfig.js';
import { PALETTE } from '../config/palette.js';
import { Assets } from '../assets/AssetRegistry.js';

// The map: ground grid, the breach path the dead walk, and tower placement
// rules. The board is centered on the world origin so the iso camera framing
// is symmetric. The ground is a single InstancedMesh (one draw call for all
// ~200 tiles) per the §14 draw-call budget; a lone highlight quad tracks the
// hovered tile instead of per-tile hover meshes.

export class World {
  constructor(scene) {
    this.scene = scene;
    this.cols = GRID.cols;
    this.rows = GRID.rows;
    this.tile = GRID.tile;
    this.width = this.cols * this.tile;
    this.depth = this.rows * this.tile;

    this.pathCells = new Set();   // "col,row" keys that are non-buildable path
    this.occupied = new Set();    // "col,row" keys holding a tower
    this.worldPath = [];          // Vector3 waypoints enemies follow, breach→ward

    this._computePath();
    this._buildGround();
    this._placeWard();
    this._buildHover();
  }

  key(col, row) { return `${col},${row}`; }

  gridToWorld(col, row, y = 0) {
    return new THREE.Vector3(
      (col + 0.5) * this.tile - this.width / 2,
      y,
      (row + 0.5) * this.tile - this.depth / 2,
    );
  }

  worldToGrid(x, z) {
    return {
      col: Math.floor((x + this.width / 2) / this.tile),
      row: Math.floor((z + this.depth / 2) / this.tile),
    };
  }

  inBounds(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  isPath(col, row) { return this.pathCells.has(this.key(col, row)); }

  canBuild(col, row) {
    return this.inBounds(col, row)
      && !this.isPath(col, row)
      && !this.occupied.has(this.key(col, row));
  }

  // Fill the cells between consecutive waypoints (cardinal segments) and record
  // the world-space waypoint centers that enemies steer toward.
  _computePath() {
    for (const wp of PATH_WAYPOINTS) {
      this.worldPath.push(this.gridToWorld(wp.col, wp.row, 0));
    }
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
      const a = PATH_WAYPOINTS[i];
      const b = PATH_WAYPOINTS[i + 1];
      const dc = Math.sign(b.col - a.col);
      const dr = Math.sign(b.row - a.row);
      let c = a.col, r = a.row;
      this.pathCells.add(this.key(c, r));
      while (c !== b.col || r !== b.row) {
        if (c !== b.col) c += dc; else if (r !== b.row) r += dr;
        this.pathCells.add(this.key(c, r));
      }
    }
    this.breach = this.worldPath[0].clone();
    this.ward = this.worldPath[this.worldPath.length - 1].clone();
  }

  _buildGround() {
    const tileGeo = new THREE.BoxGeometry(this.tile * 0.96, 0.1, this.tile * 0.96);
    const tileMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.0 });
    const count = this.cols * this.rows;
    const mesh = new THREE.InstancedMesh(tileGeo, tileMat, count);
    mesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    const buildable = new THREE.Color(PALETTE.buildable);
    const path = new THREE.Color(PALETTE.path);
    let i = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const p = this.gridToWorld(col, row, this.isPath(col, row) ? -0.06 : 0);
        m.setPosition(p);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, this.isPath(col, row) ? path : buildable);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.groundMesh = mesh;
    this.scene.add(mesh);
  }

  _placeWard() {
    const ward = Assets.create('ward');
    ward.position.copy(this.ward);
    this.scene.add(ward);
    this.wardObject = ward;
  }

  _buildHover() {
    const g = new THREE.PlaneGeometry(this.tile * 0.96, this.tile * 0.96);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: PALETTE.plagueGreen, transparent: true, opacity: 0.28, depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.visible = false;
    this.scene.add(mesh);
    this.hover = mesh;
  }

  // Show the placement highlight at a hovered tile; green=buildable, red=blocked.
  showHover(col, row) {
    if (!this.inBounds(col, row)) { this.hover.visible = false; return; }
    const ok = this.canBuild(col, row);
    this.hover.material.color.set(ok ? PALETTE.plagueGreen : PALETTE.danger);
    this.hover.position.copy(this.gridToWorld(col, row, 0.07));
    this.hover.visible = true;
    return ok;
  }

  hideHover() { this.hover.visible = false; }

  markOccupied(col, row) { this.occupied.add(this.key(col, row)); }
}
