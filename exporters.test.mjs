import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { encodeSTL, encode3MF } from './exporters.mjs';

const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
const triangles = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
const model = { text: 'A&B"<', settings: { layers: 5, height: 10 }, parts: [
  { name: 'A & base', role: 'base', color: '#124578', vertices, triangles },
  { name: 'A top', role: 'top', color: '#ffffff', vertices: vertices.map((n, i) => n + (i % 3 === 2 ? 1 : 0)), triangles },
] };
const stl = encodeSTL(model);
assert.equal(stl.length, 84 + 8 * 50);
const view = new DataView(stl.buffer);
assert.equal(view.getUint32(80, true), 8);
assert.equal(view.getFloat32(84 + 8, true), -1);
assert.equal(view.getFloat32(84 + 12 + 2 * 12 + 4, true), 0);
for (let i = 0; i < 8; i++) {
  const n = [0, 1, 2].map(k => view.getFloat32(84 + i * 50 + k * 4, true));
  assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-6);
  assert.equal(view.getUint16(84 + i * 50 + 48, true), 0);
}
assert.equal(new DataView(encodeSTL({ ...model, stlParts: [model.parts[0]] }).buffer).getUint32(80, true), 4);
const zip = unzipSync(encode3MF(model));
assert.deepEqual(Object.keys(zip).sort(), ['3D/3dmodel.model', 'Metadata/model_settings.config','Metadata/project_settings.config','[Content_Types].xml', '_rels/.rels']);
const config=strFromU8(zip['Metadata/model_settings.config']),project=JSON.parse(strFromU8(zip['Metadata/project_settings.config']));
assert.deepEqual(project.filament_colour,['#124578','#FFFFFF']);
assert.match(config,/<object id="4">/);
assert.match(config,/<part id="2"[^>]*>.*?key="extruder" value="1"/s);
assert.match(config,/<part id="3"[^>]*>.*?key="extruder" value="2"/s);
const xml = strFromU8(zip['3D/3dmodel.model']);
assert.match(xml, /unit="millimeter"/);
assert.match(xml, /A&amp;B&quot;&lt;/);
assert.match(xml, /name="A &amp; base"/);
assert.match(xml, /displaycolor="#124578FF"/);
assert.match(xml, /displaycolor="#FFFFFFFF"/);
assert.equal((xml.match(/<object /g) || []).length, 3);
assert.equal((xml.match(/<mesh>/g) || []).length, 2);
assert.equal((xml.match(/<component objectid=/g) || []).length, 2);
assert.match(xml, /id="2"[^>]*pid="1" pindex="0"/);
assert.match(xml, /id="3"[^>]*pid="1" pindex="1"/);
assert.match(xml, /<build><item objectid="4"\/>/);
assert.match(xml, /&quot;layers&quot;:5/);
assert.match(strFromU8(zip['_rels/.rels']), /Target="\/3D\/3dmodel.model"/);
assert.equal((strFromU8(unzipSync(encode3MF({ ...model, parts: [model.parts[0], { ...model.parts[1], color: '#124578' }] }))['3D/3dmodel.model']).match(/<base /g) || []).length, 1);
assert.throws(() => encodeSTL({ parts: [] }), /No model geometry/);
assert.throws(() => encode3MF({ parts: [{ ...model.parts[0], color: 'red' }] }), /Material color/);
assert.throws(() => encodeSTL({ parts: [{ ...model.parts[0], triangles: [0, 1, 99] }] }), /out of range/);
assert.throws(() => encodeSTL({ parts: [{ ...model.parts[0], vertices: [0, NaN, 0] }] }), /invalid coordinates/);
assert.throws(() => encodeSTL({ parts: [{ ...model.parts[0], triangles: [0, 0, 0] }] }), /degenerate/);
console.log('Export tests passed: binary STL, unit normals, 3MF package, colors, assembly, escaping, settings, invalid geometry.');
