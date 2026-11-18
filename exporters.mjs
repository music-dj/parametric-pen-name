import { zipSync, strToU8 } from 'fflate';

const escapeXML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

function checkedParts(model, stl = false) {
  const parts = (stl && model?.stlParts) || model?.parts;
  if (!Array.isArray(parts) || !parts.length) throw new Error('No model geometry to export.');
  for (const part of parts) {
    const { vertices: v, triangles: t } = part;
    if (!v?.length || v.length % 3 || !t?.length || t.length % 3) throw new Error('Invalid mesh array lengths.');
    for (const n of v) if (!Number.isFinite(n) || !Number.isFinite(Math.fround(n))) throw new Error('Mesh contains invalid coordinates.');
    for (const i of t) if (!Number.isInteger(i) || i < 0 || i >= v.length / 3) throw new Error('Mesh triangle index is out of range.');
  }
  return parts;
}

/** Binary STL has no colors or unit field; coordinates here are millimeters.
 * Supply stlParts containing unioned per-letter solids to omit base/top interfaces.
 */
export function encodeSTL(model) {
  const parts = checkedParts(model, true);
  const count = parts.reduce((sum, p) => sum + p.triangles.length / 3, 0);
  if (count > 0xffffffff) throw new Error('Too many triangles for STL.');
  const bytes = new Uint8Array(84 + count * 50);
  bytes.set(new TextEncoder().encode('Keychain Studio | millimeter | ' + (model.text || '')).subarray(0, 80));
  const view = new DataView(bytes.buffer);
  view.setUint32(80, count, true);
  let offset = 84;
  for (const { vertices: v, triangles: t } of parts) {
    for (let i = 0; i < t.length; i += 3) {
      const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
      const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
      const vx = v[c] - v[a], vy = v[c + 1] - v[a + 1], vz = v[c + 2] - v[a + 2];
      const normal = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const length = Math.hypot(...normal);
      if (!length) throw new Error('Mesh contains a degenerate triangle.');
      for (let k = 0; k < 3; k++) view.setFloat32(offset + k * 4, normal[k] / length, true);
      for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) view.setFloat32(offset + 12 + j * 12 + k * 4, v[t[i + j] * 3 + k], true);
      offset += 50;
    }
  }
  return bytes;
}

/** Standard materials plus Orca/Bambu part-to-filament assignments.
 * Physical spool selection remains printer-specific.
 */
export function encode3MF(model) {
  const parts = checkedParts(model);
  const materials = [];
  const indices = parts.map(p => {
    if (!/^#[0-9a-f]{6}$/i.test(p.color)) throw new Error('Material color must be #RRGGBB.');
    const color = p.color.toUpperCase();
    let i = materials.indexOf(color);
    if (i === -1) { i = materials.length; materials.push(color); }
    return i;
  });
  const objects = parts.map((p, i) => {
    const v = p.vertices, t = p.triangles;
    const vertices = [];
    for (let j = 0; j < v.length; j += 3) vertices.push(`<vertex x="${v[j]}" y="${v[j + 1]}" z="${v[j + 2]}"/>`);
    const triangles = [];
    for (let j = 0; j < t.length; j += 3) triangles.push(`<triangle v1="${t[j]}" v2="${t[j + 1]}" v3="${t[j + 2]}"/>`);
    return `<object id="${i + 2}" type="model" name="${escapeXML(p.name || p.role || `Part ${i + 1}`)}" pid="1" pindex="${indices[i]}"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object>`;
  });
  const assemblyId = parts.length + 2;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:ks="https://keychain-studio.local/metadata/1">
<metadata name="Title">${escapeXML(model.text || 'Articulated keychain')}</metadata>
<metadata name="Application">Keychain Studio</metadata>
<metadata name="BambuStudio:3mfVersion">1</metadata>
<metadata name="ks:settings">${escapeXML(JSON.stringify(model.settings || {}))}</metadata>
<resources><basematerials id="1">${materials.map((c, i) => `<base name="Material ${i + 1}" displaycolor="${c}FF"/>`).join('')}</basematerials>
${objects.join('\n')}
<object id="${assemblyId}" type="model" name="${escapeXML(model.text || 'Keychain')}"><components>${parts.map((_, i) => `<component objectid="${i + 2}"/>`).join('')}</components></object>
</resources><build><item objectid="${assemblyId}"/></build></model>`;
  const config=`<?xml version="1.0" encoding="UTF-8"?><config><object id="${assemblyId}"><metadata key="name" value="${escapeXML(model.text||'Keychain')}"/><metadata key="extruder" value="1"/>${parts.map((p,i)=>`<part id="${i+2}" subtype="normal_part"><metadata key="name" value="${escapeXML(p.name||p.role||`Part ${i+1}`)}"/><metadata key="extruder" value="${indices[i]+1}"/><mesh_stat face_count="${p.triangles.length/3}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/></part>`).join('')}</object></config>`;
  const project={filament_colour:materials,filament_settings_id:materials.map(()=> 'Generic PLA'),filament_type:materials.map(()=> 'PLA'),filament_diameter:materials.map(()=> '1.75'),filament_density:materials.map(()=> '1.24'),filament_cost:materials.map(()=> '0'),filament_is_support:materials.map(()=> '0')};
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="application/octet-stream"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(xml),
    'Metadata/model_settings.config':strToU8(config),
    'Metadata/project_settings.config':strToU8(JSON.stringify(project)),
  }, { level: 6 });
}
