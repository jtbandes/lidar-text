const textField = document.getElementById('text');
const svg = document.getElementById('svg');
const canvas = document.createElement('canvas');
let imageData;
let objectURL;
let width; // set from text size
const height = svg.clientHeight;

canvas.width = width;
canvas.height = height;

textField.value = localStorage.getItem('text') || 'hello';
textField.focus();
textField.setSelectionRange(textField.value.length, textField.value.length);
textField.addEventListener('input', () => {
  localStorage.setItem('text', textField.value);
  updateSVG();
});

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

for (const id of ['pointSize', 'density', 'rings', 'jitter', 'spread', 'tilt']) {
  document.getElementById(id).addEventListener('input', () => updateSVG());
}

// font requires a double-update to fix text metrics
document.getElementById('font').addEventListener('input', () => {
  updateSVG();
  updateSVG();
});

function updateCanvas() {
  const ctx = canvas.getContext('2d');
  const metrics = ctx.measureText(textField.value);
  if (metrics.width == 0) {
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
        const angle = Math.atan2(y - height / 2, x - width / 2) + +tilt;
        const r = Math.hypot(x - width / 2, y - height / 2);
        x = r * Math.cos(angle) + width / 2;
        y = r * Math.sin(angle) + height / 2;
        if (sampleText(x, y)) {
          pointAttrs.push({
            cx: x + (Math.random() - 0.5) * jitter,
            cy: y + (Math.random() - 0.5) * jitter,
            r: pointSize,
            style: 'fill: black',
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

updateSVG();
updateSVG(); // need a second render to get text metrics working?
