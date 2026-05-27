const fs = require('fs');
const path = require('path');

function loadBatchFixture(name) {
  const filePath = path.join(__dirname, '..', '..', name);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const data = raw.data.map((p, i) => ({
    time: new Date(p.timestamp),
    x_axis: p.x,
    y_axis: p.y,
    z_axis: p.z,
    magnitude: Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2),
    sampling_rate: raw.sampling_rate || 100
  }));
  return { node_id: raw.node_id, sampling_rate: raw.sampling_rate, data };
}

function magnitudesFromData(data) {
  return data.map((d) => parseFloat(d.magnitude));
}

module.exports = { loadBatchFixture, magnitudesFromData };
