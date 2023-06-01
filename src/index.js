import React, { createRef, forwardRef, Fragment, memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { Canvas, useFrame } from 'react-three-fiber'
import { DoubleSide } from 'three'
import { Physics, useBox, useDistanceConstraint, useParticle, useSphere, useSpring } from 'use-cannon'
import './styles.css'
import { useTrimeshFromMesh } from './utils'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const CollisionSphere = ({ sphere, position }) => {
  const [phy] = useSphere(() => ({
    mass: 0,
    position: [sphere.position.x + position[0], sphere.position.y + position[1], sphere.position.z + position[2]],
    args: [sphere.scale.x + 0.1]
  }))

  return null
}

const Mannequin = ({ position = [0, 0, 0] }) => {
  let [gltf, setGLTF] = useState()
  let [collisionObjects, setCollisionObjects] = useState([])

  useEffect(() => {
    let loader = new GLTFLoader()
    loader.load('/mannequin.glb', setGLTF)
  }, [])

  useEffect(() => {
    if (gltf) setCollisionObjects(gltf.scene.getObjectByName('collisions').children)
  }, [gltf])

  function handleClick(event) {}

  return gltf ? (
    <group position={position} onClick={handleClick}>
      <primitive object={gltf.scene} />
      {collisionObjects.map((c, i) => (
        <CollisionSphere sphere={c} position={position} key={i} />
      ))}
    </group>
  ) : null
}

const Stitch = memo(({ p1, p2, distance = 0.1 }) => {
  useDistanceConstraint(p1.current.particle, p2.current.particle, {
    distance
  })

  return null
})

const Particle = memo(
  forwardRef(({ mass, position }, ref) => {
    let [particle, api] = useParticle(() => ({
      mass,
      position,
      // args: [0.3],
      linearDamping: 0.2
    }))

    if (ref && particle.current) ref.current = { particle, api }

    return null
  })
)

const Cloth = memo(
  forwardRef(({ width, height, resolutionX, resolutionY, position }, ref) => {
    const box = useRef()
    const [readyForStitches, setReadyForStitches] = useState(false)

    const particles = useRef(Array.from({ length: resolutionY }, () => Array.from({ length: resolutionX }, createRef)))

    useEffect(() => {
      setReadyForStitches(true)
    }, [])

    useFrame(() => {
      const now = performance.now()

      if (particles.current[0][0]) {
        const geom = box.current.geometry
        geom.vertices.forEach((v, vi) => {
          let x = vi % resolutionX
          let y = Math.floor(vi / resolutionX)
          v.copy(particles.current[y][x].current.particle.current.position)
        })
        geom.verticesNeedUpdate = true
        geom.computeVertexNormals()
      }
    })

    const distanceX = width / resolutionX
    const distanceY = height / resolutionY
    const distanceDiagonal = Math.sqrt(distanceX * distanceX + distanceY * distanceY)

    function setPosition(x = 0, y = 0, z = 0) {
      particles.current[0].forEach((p, i) => {
        if (i < 2 || i > particles.current[0].length - 3)
          p.current.api.position.set((-distanceX * resolutionX) / 2 + x + distanceX * i, y, z)
      })
    }

    if (ref) {
      ref.current = {
        setPosition
      }
    }

    return (
      <group>
        <mesh ref={box}>
          <planeGeometry args={[width, height, resolutionX - 1, resolutionY - 1]} />
          <meshStandardMaterial color={'red'} side={DoubleSide} />
        </mesh>
        {particles.current.map((y, yi) =>
          y.map((x, xi) => (
            <Particle
              ref={x}
              mass={yi === 0 && (xi < 2 || xi > resolutionX - 3) ? 0 : (1 / width) * height}
              key={yi + '-' + xi}
              position={[(xi * width) / resolutionX, (yi * -height) / resolutionX + 2, 0]}
            />
          ))
        )}
        {readyForStitches &&
          particles.current.map((y, yi) =>
            y.map((x, xi) => {
              return (
                <Fragment>
                  {/* neighbor */}
                  {xi < resolutionX - 1 && (
                    <Stitch key={yi + '-' + xi + 'x'} p1={x} p2={particles.current[yi][xi + 1]} distance={distanceX} />
                  )}
                  {yi < resolutionY - 1 && (
                    <Stitch key={yi + '-' + xi + 'y'} p1={x} p2={particles.current[yi + 1][xi]} distance={distanceY} />
                  )}
                  {/* shear */}
                  {yi < resolutionY - 1 && xi < resolutionX - 1 && (
                    <Stitch key={yi + '-' + xi + 's1'} p1={x} p2={particles.current[yi + 1][xi + 1]} distance={distanceDiagonal} />
                  )}
                  {yi > 0 && xi < resolutionX - 1 && (
                    <Stitch key={yi + '-' + xi + 's2'} p1={x} p2={particles.current[yi - 1][xi + 1]} distance={distanceDiagonal} />
                  )}
                  {/* flex */}
                  {/* {xi < resolutionX - 2 && (
                    <Stitch key={yi + '-' + xi + 'f1'} p1={x} p2={particles.current[yi][xi + 2]} distance={distanceX * 2} />
                  )}
                  {yi < resolutionY - 2 && (
                    <Stitch key={yi + '-' + xi + 'f2'} p1={x} p2={particles.current[yi + 2][xi]} distance={distanceY * 2} />
                  )}{' '} */}
                </Fragment>
              )
            })
          )}
      </group>
    )
  })
)

const Ball = () => {
  const [ball, api] = useSphere(() => ({
    mass: 0,
    args: [1]
  }))

  useFrame(() => {
    const now = performance.now()
    api.position.set(0, Math.sin(now / 400) * 0.5, -1 + Math.cos(now / 400) * 1)
  })

  return (
    <mesh ref={ball} scale={[0.8, 0.8, 0.8]}>
      <sphereBufferGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color={'blue'} />
    </mesh>
  )
}

const App = () => {
  const cloth = useRef()

  useEffect(() => {
    function handleMouseMove(event) {
      let x = (event.clientX - window.innerWidth / 2) / window.innerWidth
      let y = -(event.clientY - window.innerHeight / 2) / window.innerHeight
      cloth.current.setPosition(x * 6, y * 6, 0)
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <Fragment>
      <directionalLight position={[1, 1, 1]} />
      <Physics iterations={10} gravity={[0, -20, 0]}>
        <Cloth ref={cloth} width={4} height={4} resolutionX={16} resolutionY={16} />
        {/* <Mannequin position={[0, 0, -0.3]} /> */}
        <Ball />
      </Physics>
    </Fragment>
  )
}

ReactDOM.render(
  <Canvas>
    <App />
  </Canvas>,
  document.getElementById('root')
)
