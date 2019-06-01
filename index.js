const textField = document.getElementById('text');
const svg = document.getElementById('svg');
const canvas = document.createElement('canvas');
let imageData;
let objectURL;
let width; // set from text size
const height = svg.clientHeight;

const fieldIds = ['text', 'pointSize', 'density', 'rings', 'jitter', 'spread', 'tilt', 'font', 'color'];

function init() {
  canvas.width = width;
  canvas.height = height;

  for (const id of fieldIds) {
    const value = localStorage.getItem(id);
    if (value != null) {
      document.getElementById(id).value = value;
    }
  }
  textField.value = textField.value || 'hello';
  textField.focus();
  textField.setSelectionRange(textField.value.length, textField.value.length);

  for (const id of fieldIds) {
    document.getElementById(id).addEventListener('input', (event) => {
      updateSVG();
      localStorage.setItem(id, event.target.value);
    });
  }

  updateSVG();
}

document.getElementById('download').addEventListener('click', (event) => {
  // remove hidden children before saving
  for (const child of Array.from(svg.getElementById('points').childNodes)) {
    if (child.style.display === 'none') {
      child.remove();
    }
  }
  const data = `
<svg version="1.1" xmlns="http://www.w3.org/2000/svg">
  ${svg.innerHTML}
</svg>
`;
  if (objectURL) {
    URL.revokeObjectURL(objectURL);
  }
  objectURL = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }));
  setAttrs(event.target, { href: objectURL, download: textField.value });
});

function createElementSVG(name, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  setAttrs(el, attrs);
  return el;
}

function setAttrs(node, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v);
  }
}

function removeAllChildren(node) {
  for (const child of Array.from(node.childNodes)) {
    node.removeChild(child);
  }
}

// ensure there are at least n circles (mark extras as display: none)
function makeCircles(parent, n) {
  while (parent.childNodes.length < n) {
    parent.appendChild(createElementSVG('circle'));
  }
  for (let i = 0; i < parent.childNodes.length; i++) {
    parent.childNodes[i].style.display = i < n ? '' : 'none';
  }
}

function rotate(x, y, cx, cy, angle) {
  const a = Math.atan2(y - cy, x - cx) + angle;
  const r = Math.hypot(x - cx, y - cy);
  x = r * Math.cos(a) + width / 2;
  y = r * Math.sin(a) + height / 2;
  return [x, y];
}

function updateCanvas() {
  const ctx = canvas.getContext('2d');

  // font needs to be set once before measuring and once before rendering (after changing width)
  ctx.font = document.getElementById('font').value;
  const metrics = ctx.measureText(textField.value);
  if (metrics.width === 0) {
    imageData = { data: [], width: 0, height: 0 };
    return;
  }

  width = metrics.width;
  canvas.width = metrics.width;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'black';
  ctx.textBaseline = 'middle';
  ctx.font = document.getElementById('font').value;
  ctx.fillText(textField.value, 0, canvas.height / 2);

  imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function sampleText(x, y) {
  if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
    return false;
  }
  const ctx = canvas.getContext('2d');
  let i = Math.floor(y) * 4 * imageData.width + Math.floor(x) * 4;
  if (i > imageData.data.length) {
    throw new Error(`Pixel out of bounds: x=${x} y=${y} i=${i} length=${imageData.data.length}`);
  }
  if (imageData.data[i + 0] != 255) return true;
  if (imageData.data[i + 1] != 255) return true;
  if (imageData.data[i + 2] != 255) return true;
  return false;
}

function updateSVG() {
  updateCanvas();
  const pointSize = document.getElementById('pointSize').value;
  const steps = document.getElementById('density').value;
  let rings = document.getElementById('rings').value;
  const jitter = document.getElementById('jitter').value;
  const spread = document.getElementById('spread').value;
  const tilt = document.getElementById('tilt').value;
  const font = document.getElementById('font').value;
  const color = document.getElementById('color').value;
  textField.style.font = font;

  const text = createElementSVG('text');
  const points = svg.getElementById('points');
  let pointAttrs = [];
  const yBuffer = 2; // extra rings to avoid whitespace when tilt is large
  rings *= yBuffer;
  for (let ring = 0; ring < rings; ring++) {
    for (let a = -1; a <= 1; a += 2) {
      for (let step = 0; step < steps; step++) {
        const t = Math.asinh(spread) * 2 * (step / steps - 0.5);
        let x = width * (Math.sinh(t) / spread + 0.5);
        let y = height * ((a * yBuffer * Math.cosh(t) * ring) / rings + 0.5);
        [x, y] = rotate(x, y, width / 2, height / 2, +tilt);
        if (sampleText(x, y)) {
          pointAttrs.push({
            cx: x + (Math.random() - 0.5) * jitter,
            cy: y + (Math.random() - 0.5) * jitter,
            r: pointSize,
            style: 'fill:' + color,
          });
        }
      }
      if (ring === 0) {
        break;
      }
    }
  }
  makeCircles(points, pointAttrs.length);
  pointAttrs.forEach((attrs, i) => {
    setAttrs(points.childNodes[i], attrs);
  });
}

init();
