import { useMemo } from 'react'
import { Geometry } from 'three'
import { useTrimesh } from 'use-cannon'

export function trimeshFromGeometry(geometry) {
  let geom = new Geometry().fromBufferGeometry(geometry)
  let verts = []
  let faces = []

  geom.vertices.forEach((v) => verts.push(v.x, v.y, v.z))
  geom.faces.forEach((f) => faces.push(f.a, f.b, f.c))

  return {
    verts,
    faces,
    geom
  }
}

export function useTrimeshFromMesh(mesh, mass = 0) {
  let geo = useMemo(() => {
    return trimeshFromGeometry(mesh.geometry)
  }, [mesh])
  let [ref, api] = useTrimesh(() => ({
    mass: 0,
    args: [geo.verts, geo.faces],

    position: [mesh.position.x, mesh.position.y, mesh.position.z],
    rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z]
  }))

  return [ref, api]
}
