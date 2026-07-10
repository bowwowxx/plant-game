import * as THREE from './vendor/three.module.js';

const COLORS = {
  dark: 0x061d24, platform: 0x06433a, platformSide: 0x032d30,
  tileA: 0x1e936c, tileB: 0x168161, line: 0x075347,
  wood: 0x8b5636, woodLight: 0xb6784e, stone: 0x7b8d91,
  leaf: 0x168066, leafDark: 0x0e5d4d
};

function material(color, roughness = .86, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function addMesh(group, geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function box(group, size, color, position, rotation, scale) {
  return addMesh(group, new THREE.BoxGeometry(...size), material(color), position, rotation, scale);
}

function sphere(group, radius, color, position, scale = [1, 1, 1], segments = 10) {
  return addMesh(group, new THREE.SphereGeometry(radius, segments, 7), material(color), position, [0, 0, 0], scale);
}

function cylinder(group, top, bottom, height, color, position, rotation = [0, 0, 0], segments = 8) {
  return addMesh(group, new THREE.CylinderGeometry(top, bottom, height, segments), material(color), position, rotation);
}

function createTree(scale = 1) {
  const group = new THREE.Group();
  cylinder(group, .12, .17, 1.25, 0x8a5a3c, [0, .55, 0]);
  [[1.05, 1.05], [.82, 1.62], [.58, 2.08]].forEach(([radius, y], index) => {
    addMesh(group, new THREE.ConeGeometry(radius, 1.35, 7), material(index % 2 ? COLORS.leaf : COLORS.leafDark), [0, y, 0]);
  });
  group.scale.setScalar(scale);
  return group;
}

function createFence() {
  const group = new THREE.Group();
  const wood = material(COLORS.wood);
  [-.38, .38].forEach(x => addMesh(group, new THREE.BoxGeometry(.12, .95, .14), wood, [x, .45, 0]));
  addMesh(group, new THREE.BoxGeometry(1.05, .13, .13), wood, [0, .35, 0]);
  addMesh(group, new THREE.BoxGeometry(1.05, .13, .13), wood, [0, .68, 0]);
  group.rotation.y = Math.PI / 2;
  return group;
}

function createGrave() {
  const group = new THREE.Group();
  box(group, [.58, .72, .2], COLORS.stone, [0, .36, 0]);
  sphere(group, .29, COLORS.stone, [0, .72, 0], [1, .8, .38]);
  box(group, [.72, .12, .32], 0x596b70, [0, .06, 0]);
  const cross = material(0x53656a);
  addMesh(group, new THREE.BoxGeometry(.08, .35, .04), cross, [0, .42, -.12]);
  addMesh(group, new THREE.BoxGeometry(.25, .07, .04), cross, [0, .49, -.12]);
  return group;
}

function createHouse() {
  const group = new THREE.Group();
  box(group, [2.35, 1.05, 1.7], 0xd77c4d, [0, .55, 0]);
  box(group, [.5, .75, .05], 0x6c3f32, [.45, .4, -.88]);
  box(group, [.45, .38, .06], 0xaee3da, [-.55, .58, -.89]);
  const roof = addMesh(group, new THREE.ConeGeometry(1.7, .9, 4), material(0x98563f), [0, 1.48, 0], [0, Math.PI / 4, 0], [1.15, 1, .85]);
  roof.castShadow = true;
  return group;
}

function createBush(scale = 1, flowers = false) {
  const group = new THREE.Group();
  [[-.28,.28,0], [.25,.3,.04], [0,.48,.05], [-.05,.28,.28]].forEach(([x,y,z], index) => sphere(group, .34, index % 2 ? 0x27845a : 0x1c704e, [x, y, z], [1.15, .9, 1]));
  if (flowers) [[-.25,.55,-.08], [.18,.62,.08], [.4,.38,-.05]].forEach(([x,y,z], index) => sphere(group, .07, [0xf5c85b, 0xe87e9e, 0xa8d4ff][index], [x,y,z], [1, .6, 1], 7));
  group.scale.setScalar(scale);
  return group;
}

function createFlowerPatch() {
  const group = new THREE.Group();
  const colors = [0xf0b84f, 0xed789b, 0x8bcff0, 0xf5eee0];
  for (let i = 0; i < 7; i++) {
    const x = (i % 4) * .22 - .32, z = Math.floor(i / 4) * .24 - .12;
    cylinder(group, .018, .025, .35 + (i % 2) * .08, 0x438b49, [x, .18, z]);
    sphere(group, .09, colors[i % colors.length], [x, .39 + (i % 2) * .08, z], [1.1, .55, 1], 7);
  }
  return group;
}

function createRockCluster() {
  const group = new THREE.Group();
  [[-.25,.16,0,.32], [.15,.12,.08,.25], [.36,.1,-.08,.18]].forEach(([x,y,z,s], index) => sphere(group, s, index % 2 ? 0x6e817e : 0x81938d, [x,y,z], [1.2,.65,1], 7));
  return group;
}

function createLamp() {
  const group = new THREE.Group();
  cylinder(group, .055, .08, 1.7, 0x263b3a, [0,.85,0]);
  box(group, [.42,.12,.42], 0x263b3a, [0,1.68,0]);
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xff9b2f, emissiveIntensity: 2.4, roughness: .3 });
  addMesh(group, new THREE.OctahedronGeometry(.2, 0), glow, [0,1.48,0]);
  addMesh(group, new THREE.ConeGeometry(.35,.28,4), material(0x304945), [0,1.92,0], [0,Math.PI/4,0]);
  const light = new THREE.PointLight(0xffb84d, 1.4, 4); light.position.set(0,1.5,0); group.add(light);
  return group;
}

function createMailbox() {
  const group = new THREE.Group();
  cylinder(group, .08, .11, 1.15, 0x76503a, [0,.55,0]);
  box(group, [.65,.42,.45], 0x507c7a, [0,1.1,0]);
  cylinder(group, .325, .325, .45, 0x507c7a, [0,1.31,0], [Math.PI/2,0,0], 12);
  box(group, [.07,.55,.07], 0xd5594e, [.4,1.2,0]);
  box(group, [.3,.16,.05], 0xd5594e, [.52,1.42,0]);
  return group;
}

function createBench() {
  const group = new THREE.Group();
  [-.46,.46].forEach(x => { box(group,[.09,.55,.1],0x344642,[x,.28,0]); box(group,[.09,.55,.1],0x344642,[x,.28,.45]); });
  box(group,[1.2,.12,.52],COLORS.woodLight,[0,.48,.2]);
  box(group,[1.2,.5,.12],COLORS.wood,[0,.78,.48]);
  return group;
}

function createSunPlant() {
  const group = new THREE.Group();
  cylinder(group, .07, .09, .75, 0x3f9a4c, [0, .38, 0]);
  sphere(group, .22, 0x52b45c, [-.2, .24, 0], [1.5, .35, .75]);
  sphere(group, .22, 0x52b45c, [.2, .22, .02], [1.5, .35, .75]);
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    sphere(group, .18, 0xf4b43f, [Math.cos(angle) * .32, .9 + Math.sin(angle) * .32, 0], [1, 1.5, .55], 8);
  }
  sphere(group, .29, 0xffd65e, [0, .9, -.02]);
  sphere(group, .035, 0x312d27, [-.1, .95, -.27]);
  sphere(group, .035, 0x312d27, [.1, .95, -.27]);
  group.scale.setScalar(.8);
  return group;
}

function createShooter(ice = false) {
  const group = new THREE.Group();
  const main = ice ? 0x73d4e8 : 0x5cbd55;
  const dark = ice ? 0x378aa3 : 0x2f7b3c;
  cylinder(group, .08, .1, .62, dark, [0, .33, 0]);
  sphere(group, .24, main, [-.2, .18, 0], [1.5, .35, .9]);
  sphere(group, .24, main, [.2, .17, 0], [1.5, .35, .9]);
  sphere(group, .36, main, [0, .8, 0]);
  cylinder(group, .18, .23, .5, main, [.38, .83, 0], [0, 0, Math.PI / 2]);
  cylinder(group, .22, .18, .16, dark, [.65, .83, 0], [0, 0, Math.PI / 2]);
  sphere(group, .045, 0x182b24, [.07, .9, -.33]);
  if (ice) {
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      const spike = addMesh(group, new THREE.ConeGeometry(.08, .28, 5), material(0xb9f4ff), [Math.cos(angle) * .33, .8 + Math.sin(angle) * .33, 0], [0, 0, -angle]);
      spike.rotation.z = -angle;
    }
  }
  group.scale.setScalar(.82);
  return group;
}

function createPumpkin() {
  const group = new THREE.Group();
  for (let i = -2; i <= 2; i++) sphere(group, .46, i % 2 ? 0xd96e35 : 0xef8741, [i * .13, .45, 0], [.75, 1.05, 1]);
  cylinder(group, .08, .1, .24, 0x4c873d, [0, .96, 0], [0, 0, -.18]);
  sphere(group, .045, 0x35251e, [-.14, .53, -.43]); sphere(group, .045, 0x35251e, [.14, .53, -.43]);
  box(group, [.3, .05, .04], 0x593121, [0, .35, -.44]);
  group.scale.setScalar(.88);
  return group;
}

function createZombie(armored = false, boss = false) {
  const group = new THREE.Group();
  const skin = boss ? 0x438d68 : 0x56a97a;
  box(group, [.55, .65, .34], boss ? 0x6b3f72 : 0x5b7380, [0, .85, 0]);
  box(group, [.24, .62, .24], 0x6a4030, [-.17, .32, 0]);
  box(group, [.24, .62, .24], 0x6a4030, [.17, .32, 0]);
  box(group, [.18, .18, .4], 0x282a31, [-.18, .02, -.08]);
  box(group, [.18, .18, .4], 0x282a31, [.18, .02, -.08]);
  const head = box(group, [.68, .64, .55], skin, [0, 1.42, 0]);
  box(group, [.72, .22, .6], 0x182e3b, [0, 1.82, 0]);
  sphere(group, .09, 0xe9ead3, [-.17, 1.5, -.3], [1.25,1,.45]);
  sphere(group, .09, 0xe9ead3, [.17, 1.5, -.3], [1.25,1,.45]);
  sphere(group, .035, boss ? 0xff4e44 : 0x3b352c, [-.17, 1.49, -.36]);
  sphere(group, .035, boss ? 0xff4e44 : 0x3b352c, [.17, 1.49, -.36]);
  const browLeft = box(group, [.24,.055,.045], 0x17272c, [-.17,1.66,-.32], [0,0,-.18]);
  const browRight = box(group, [.24,.055,.045], 0x17272c, [.17,1.66,-.32], [0,0,.18]);
  sphere(group, .09, 0x3e7e61, [0,1.4,-.34], [.65,1,.7]);
  sphere(group, .12, skin, [-.38,1.43,0], [.55,1,.75]); sphere(group, .12, skin, [.38,1.43,0], [.55,1,.75]);
  const mouth = box(group, [.34,.14,.045], 0x342524, [0,1.23,-.31]);
  box(group, [.09,.09,.035], 0xf2e7c7, [-.09,1.27,-.345]); box(group, [.09,.09,.035], 0xf2e7c7, [.08,1.27,-.345]);
  const armLeft = box(group, [.2, .72, .2], skin, [-.44, .88, 0], [0, 0, -.35]);
  const armRight = box(group, [.2, .72, .2], skin, [.44, .88, 0], [0, 0, .35]);
  if (armored) {
    addMesh(group, new THREE.ConeGeometry(.46, .95, 7), material(0xc55e43), [0, 2.18, 0]);
    cylinder(group, .5, .5, .1, 0xf1ae5c, [0, 1.76, 0]);
  }
  if (boss) {
    box(group,[.92,.16,.72],0x4d2d57,[0,1.86,0]);
    for (let i=-2;i<=2;i++) addMesh(group,new THREE.ConeGeometry(.11,.42,5),material(0xf1bd4f),[i*.18,2.12,0]);
    sphere(group,.18,0x8a3761,[0,2.04,-.08],[1,.7,.55]);
  }
  group.userData = { head, mouth, browLeft, browRight, armLeft, armRight, boss };
  group.scale.setScalar(boss ? .88 : .58);
  group.rotation.y = Math.PI / 2;
  return group;
}

function createMower() {
  const group = new THREE.Group();
  box(group, [.72, .3, .55], 0xd64d3d, [0, .24, 0]);
  [-.28, .28].forEach(x => [-.25, .25].forEach(z => cylinder(group, .12, .12, .1, 0x24312d, [x, .12, z], [Math.PI / 2, 0, 0], 10)));
  cylinder(group, .035, .035, .9, 0xd9e0d8, [-.25, .75, .15], [0, 0, -.55]);
  group.scale.setScalar(.72);
  return group;
}

export function createWorld(canvas, logicalWidth, logicalHeight) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog(COLORS.dark, 17, 28);
  const camera = new THREE.OrthographicCamera(-7, 7, 4.5, -4.5, .1, 60);
  camera.position.set(-8.5, 11.5, 12.5);
  camera.lookAt(4, 0, 2.3);

  scene.add(new THREE.HemisphereLight(0xd9fff3, 0x13362f, 2.25));
  const sun = new THREE.DirectionalLight(0xffe0a5, 4.2);
  sun.position.set(-6, 13, -5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12; scene.add(sun);

  const stage = new THREE.Group(); scene.add(stage);
  const platform = addMesh(stage, new THREE.BoxGeometry(11.2, .58, 7), material(COLORS.platformSide), [4.3, -.35, 2]);
  platform.receiveShadow = true;

  const tiles = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 9; col++) {
    const tile = addMesh(stage, new THREE.BoxGeometry(.94, .12, .94), material((row + col) % 2 ? COLORS.tileA : COLORS.tileB), [col, .02, row]);
    tile.userData = { col, row }; tiles.push(tile);
  }

  const house = createHouse(); house.position.set(-2.35, 0, 4.25); house.rotation.y = .12; stage.add(house);
  const treeA = createTree(1.15); treeA.position.set(-2.4, 0, -.6); stage.add(treeA);
  const treeB = createTree(.8); treeB.position.set(8.4, 0, -1.25); stage.add(treeB);
  const treeC = createTree(.72); treeC.position.set(9.7, 0, 5.15); stage.add(treeC);
  const treeD = createTree(.62); treeD.position.set(-1.35, 0, 5.5); stage.add(treeD);
  for (let row = 0; row < 5; row++) { const fence = createFence(); fence.position.set(-.75, 0, row); stage.add(fence); }
  [[8.65, .25], [8.8, 1.7], [8.65, 3.2], [9.25, 4.35]].forEach(([x, z]) => { const grave = createGrave(); grave.position.set(x, 0, z); grave.rotation.y = -.18; stage.add(grave); });
  [[.2,-1.05,.85,true], [2.7,-1.1,.7,false], [5.5,-1.08,.8,true], [7.6,5.2,.72,true]].forEach(([x,z,s,flowers]) => { const bush=createBush(s,flowers); bush.position.set(x,0,z); stage.add(bush); });
  [[1.4,5.15], [4.6,5.2], [6.8,-1.08]].forEach(([x,z]) => { const patch=createFlowerPatch(); patch.position.set(x,0,z); stage.add(patch); });
  [[-1.05,-1.12], [9.25,-.82], [8.7,5.25], [3.4,5.22]].forEach(([x,z]) => { const rocks=createRockCluster(); rocks.position.set(x,0,z); stage.add(rocks); });
  const lampA=createLamp(); lampA.position.set(4.1,0,-1.12); stage.add(lampA);
  const lampB=createLamp(); lampB.position.set(7.55,0,5.15); stage.add(lampB);
  const mailbox=createMailbox(); mailbox.position.set(9.3,0,5.1); mailbox.rotation.y=-.35; stage.add(mailbox);
  const bench=createBench(); bench.position.set(-1.05,0,1.2); bench.rotation.y=Math.PI/2; stage.add(bench);
  for (let i=0;i<6;i++) { const stone=sphere(stage,.22,i%2?0x7c8b82:0x8b988e,[-1.12,.03,i*.75-.1],[1.4,.25,1],7); stone.rotation.y=i*.4; }

  const plantMeshes = new Map();
  const enemyMeshes = new Map();
  const bulletMeshes = new Map();
  const mowerMeshes = new Map();
  const cursor = addMesh(stage, new THREE.BoxGeometry(.98, .08, .98), new THREE.MeshStandardMaterial({ color: 0xe7ff92, emissive: 0x526b1c, transparent: true, opacity: .55 }), [0, .14, 0]);
  cursor.visible = false;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function resize() {
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const viewWidth = 14.5;
    const viewHeight = viewWidth / aspect;
    camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();

  function screenPoint(x, y, z) {
    const point = new THREE.Vector3(x, y, z).project(camera);
    return { x: (point.x + 1) * .5 * logicalWidth, y: (1 - point.y) * .5 * logicalHeight };
  }

  function pickCell(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(tiles, false)[0];
    return hit ? { ...hit.object.userData } : null;
  }

  function syncMap(map, items, makeMesh, updateMesh) {
    for (const [item, mesh] of map) if (!items.includes(item)) { stage.remove(mesh); map.delete(item); }
    items.forEach(item => {
      if (!map.has(item)) { const mesh = makeMesh(item); stage.add(mesh); map.set(item, mesh); }
      updateMesh(map.get(item), item);
    });
  }

  function sync(state, time, hoverCell) {
    syncMap(plantMeshes, state.plants, plant => plant.id === 'sun' ? createSunPlant() : plant.id === 'wall' ? createPumpkin() : createShooter(plant.id === 'ice'), (mesh, plant) => {
      mesh.position.set(plant.col, .14 + Math.sin(time * .002 + plant.bob) * .025, plant.row);
      const p = screenPoint(plant.col, .8, plant.row); plant.x = p.x; plant.y = p.y;
    });
    syncMap(enemyMeshes, state.enemies, enemy => createZombie(enemy.armored, enemy.boss), (mesh, enemy) => {
      mesh.position.set(enemy.gx, .12 + Math.sin(enemy.step) * .025, enemy.row);
      mesh.rotation.z = Math.sin(enemy.step) * .025;
      const expression = mesh.userData;
      if (expression.mouth) expression.mouth.scale.y = .8 + Math.abs(Math.sin(enemy.step * .65)) * .8;
      if (expression.armLeft) expression.armLeft.rotation.x = Math.sin(enemy.step) * .35;
      if (expression.armRight) expression.armRight.rotation.x = -Math.sin(enemy.step) * .35;
      if (expression.boss && expression.head) expression.head.rotation.z = Math.sin(enemy.step * .35) * .05;
      const p = screenPoint(enemy.gx, 1, enemy.row); enemy.x = p.x; enemy.y = p.y;
    });
    syncMap(bulletMeshes, state.bullets, bullet => {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(.12, 1), material(bullet.ice ? 0xb8f4ff : 0x78d85c, .4));
      mesh.castShadow = true; return mesh;
    }, (mesh, bullet) => {
      mesh.position.set(bullet.gx, .72, bullet.row);
      const p = screenPoint(bullet.gx, .72, bullet.row); bullet.x = p.x; bullet.y = p.y;
    });
    syncMap(mowerMeshes, state.mowers, () => createMower(), (mesh, mower) => {
      mesh.position.set(mower.gx, .1, mower.row); mesh.rotation.y = -Math.PI / 2;
      mesh.visible = !mower.used || mower.active;
    });

    cursor.visible = Boolean(state.running && !state.paused && (state.selected || state.shovelMode) && hoverCell);
    if (cursor.visible) {
      cursor.position.set(hoverCell.col, .14, hoverCell.row);
      cursor.material.color.set(state.shovelMode ? 0xffb35a : state.plants.some(p => p.col === hoverCell.col && p.row === hoverCell.row) ? 0xff6b5a : 0xe7ff92);
    }
    renderer.render(scene, camera);
  }

  return { pickCell, screenPoint, sync, resize };
}
