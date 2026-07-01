import * as THREE from 'three'

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100)
camera.position.z = 3

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(devicePixelRatio)
document.body.appendChild(renderer.domElement)

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(),
  new THREE.MeshStandardMaterial({ color: 0x33ff88, roughness: 0.3, metalness: 0.4 })
)
scene.add(cube)
scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.2))
const key = new THREE.DirectionalLight(0xffffff, 1.5)
key.position.set(2, 3, 4)
scene.add(key)

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

renderer.setAnimationLoop((t) => {
  cube.rotation.x = t / 2000
  cube.rotation.y = t / 1200
  renderer.render(scene, camera)
})
