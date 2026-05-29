import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF, OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'

function Model() {
  const { scene } = useGLTF(import.meta.env.BASE_URL + 'model.glb')
  const { camera, controls } = useThree()
  const ref = useRef()

  useEffect(() => {
    if (!ref.current) return
    const box = new THREE.Box3().setFromObject(ref.current)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    ref.current.position.sub(center)

    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = camera.fov * (Math.PI / 180)
    let distance = maxDim / (2 * Math.tan(fov / 2))
    distance *= 1.5

    camera.position.set(0, 0, distance)
    camera.near = distance / 100
    camera.far = distance * 100
    camera.updateProjectionMatrix()

    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
  }, [scene, camera, controls])

  return <primitive ref={ref} object={scene} />
}

function Model2({ orbitRef }) {
  const { scene } = useGLTF(import.meta.env.BASE_URL + 'model2.glb')
  const { camera, gl } = useThree()
  const ref = useRef()
  const dragging = useRef(false)
  const dragPlane = useRef(new THREE.Plane())
  const dragOffset = useRef(new THREE.Vector3())
  const localRaycaster = useRef(new THREE.Raycaster())
  const mouseNDC = useRef(new THREE.Vector2())

  useEffect(() => {
    if (!ref.current) return
    // Scale first so bounding box reflects actual world size
    ref.current.scale.setScalar(0.02)
    const box = new THREE.Box3().setFromObject(ref.current)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    // Center at origin, then nudge slightly so it's not buried inside model1
    ref.current.position.sub(center)
    ref.current.position.x += size.x
    ref.current.position.y += size.y * 2
  }, [scene])

  // Global drag-move, drag-end, and wheel-while-dragging handlers
  useEffect(() => {
    const canvas = gl.domElement

    const onMouseMove = (e) => {
      if (!dragging.current || !ref.current) return
      const rect = canvas.getBoundingClientRect()
      mouseNDC.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      localRaycaster.current.setFromCamera(mouseNDC.current, camera)
      const hit = new THREE.Vector3()
      if (localRaycaster.current.ray.intersectPlane(dragPlane.current, hit)) {
        ref.current.position.copy(hit).add(dragOffset.current)
      }
    }

    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      if (orbitRef.current) orbitRef.current.enabled = true
      canvas.style.cursor = 'auto'
    }

    // Rotate model2 with wheel while left button is held; OrbitControls is
    // already disabled during drag so it won't compete.
    const onWheel = (e) => {
      if (!dragging.current || !ref.current) return
      e.preventDefault()
      ref.current.rotation.y -= e.deltaY * 0.005
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [camera, gl, orbitRef])

  const onPointerDown = (e) => {
    e.stopPropagation()
    dragging.current = true
    if (orbitRef.current) orbitRef.current.enabled = false
    // Drag plane facing the camera through the click point
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate()
    dragPlane.current.setFromNormalAndCoplanarPoint(normal, e.point)
    dragOffset.current.copy(ref.current.position).sub(e.point)
    gl.domElement.style.cursor = 'grabbing'
  }

  return (
    <primitive
      ref={ref}
      object={scene}
      onPointerOver={(e) => { e.stopPropagation(); gl.domElement.style.cursor = 'grab' }}
      onPointerOut={() => { if (!dragging.current) gl.domElement.style.cursor = 'auto' }}
      onPointerDown={onPointerDown}
    />
  )
}

export default function App() {
  const orbitRef = useRef()

  return (
    <Canvas
      style={{ width: '100vw', height: '100vh', background: '#111' }}
      camera={{ fov: 45, near: 0.1, far: 10000, position: [0, 0, 5] }}
    >
      <Suspense fallback={null}>
        <Model />
      </Suspense>
      <Suspense fallback={null}>
        <Model2 orbitRef={orbitRef} />
      </Suspense>
      <Suspense fallback={null}>
        <Environment preset="apartment" background={false} />
      </Suspense>
      <OrbitControls ref={orbitRef} makeDefault />
    </Canvas>
  )
}
