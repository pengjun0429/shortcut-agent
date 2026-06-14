const sharp = require('sharp');
const path = require('path');

const sizes = [16, 32, 48, 64, 128, 256];
const outputDir = path.join(__dirname, 'build', 'icons');

async function generateIcon() {
  const fs = require('fs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Create base 512x512 icon with SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <radialGradient id="bg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1a1a3e"/>
        <stop offset="100%" stop-color="#0a0a1a"/>
      </radialGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="8" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="innerGlow">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    <!-- Background circle -->
    <circle cx="256" cy="256" r="240" fill="url(#bg)" stroke="#00f0ff" stroke-width="4"/>
    <circle cx="256" cy="256" r="230" fill="none" stroke="#00f0ff" stroke-width="1" opacity="0.3"/>
    
    <!-- Circuit lines -->
    <g stroke="#00f0ff" stroke-width="2" opacity="0.4" filter="url(#innerGlow)">
      <line x1="80" y1="180" x2="180" y2="180"/>
      <line x1="180" y1="180" x2="200" y2="150"/>
      <line x1="332" y1="180" x2="432" y2="180"/>
      <line x1="312" y1="150" x2="332" y2="180"/>
      <line x1="80" y1="332" x2="160" y2="332"/>
      <line x1="160" y1="332" x2="180" y2="362"/>
      <line x1="332" y1="332" x2="432" y2="332"/>
      <line x1="312" y1="362" x2="332" y2="332"/>
      <!-- Vertical lines -->
      <line x1="140" y1="100" x2="140" y2="180"/>
      <line x1="372" y1="100" x2="372" y2="180"/>
      <line x1="140" y1="332" x2="140" y2="412"/>
      <line x1="372" y1="332" x2="372" y2="412"/>
    </g>
    
    <!-- Circuit nodes -->
    <g fill="#00f0ff" filter="url(#innerGlow)" opacity="0.6">
      <circle cx="180" cy="180" r="4"/>
      <circle cx="332" cy="180" r="4"/>
      <circle cx="160" cy="332" r="4"/>
      <circle cx="332" cy="332" r="4"/>
      <circle cx="140" cy="100" r="3"/>
      <circle cx="372" cy="100" r="3"/>
      <circle cx="140" cy="412" r="3"/>
      <circle cx="372" cy="412" r="3"/>
    </g>
    
    <!-- Keyboard key -->
    <g transform="translate(256,256)" filter="url(#glow)">
      <!-- Key body -->
      <rect x="-65" y="-45" width="130" height="90" rx="12" fill="#1a1a3e" stroke="#00f0ff" stroke-width="3"/>
      <!-- Key shadow -->
      <rect x="-62" y="-42" width="124" height="84" rx="10" fill="none" stroke="#00f0ff" stroke-width="1" opacity="0.3"/>
      
      <!-- Slash icon / -->
      <text x="0" y="18" font-family="monospace" font-size="52" font-weight="bold" fill="#00f0ff" text-anchor="middle" filter="url(#innerGlow)">/</text>
      
      <!-- Glow dots on key -->
      <circle cx="-40" cy="-25" r="3" fill="#ff00de" opacity="0.8"/>
      <circle cx="40" cy="-25" r="3" fill="#39ff14" opacity="0.8"/>
    </g>
    
    <!-- Chinese text -->
    <text x="256" y="400" font-family="sans-serif" font-size="36" font-weight="bold" fill="#00f0ff" text-anchor="middle" filter="url(#glow)">快捷鍵特工</text>
    
    <!-- Top accent line -->
    <line x1="120" y1="60" x2="392" y2="60" stroke="#ff00de" stroke-width="2" opacity="0.5"/>
    <line x1="120" y1="452" x2="392" y2="452" stroke="#39ff14" stroke-width="2" opacity="0.5"/>
  </svg>`;

  // Generate PNG at 512x512
  const png512 = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
  require('fs').writeFileSync(path.join(outputDir, 'icon.png'), png512);
  console.log('Generated icon.png (512x512)');

  // Generate .ico file (Windows)
  const icoBuffers = [];
  for (const size of sizes) {
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    icoBuffers.push({ size, buf });
  }

  // Build ICO file manually
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);     // reserved
  icoHeader.writeUInt16LE(1, 2);     // type: icon
  icoHeader.writeUInt16LE(sizes.length, 4); // count

  let dataOffset = 6 + (sizes.length * 16);
  const entries = [];
  const imageData = [];

  for (const { size, buf } of icoBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);  // width
    entry.writeUInt8(size === 256 ? 0 : size, 1);  // height
    entry.writeUInt8(0, 2);    // color palette
    entry.writeUInt8(0, 3);    // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8);  // data size
    entry.writeUInt32LE(dataOffset, 12); // data offset
    entries.push(entry);
    imageData.push(buf);
    dataOffset += buf.length;
  }

  const ico = Buffer.concat([icoHeader, ...entries, ...imageData]);
  require('fs').writeFileSync(path.join(outputDir, 'icon.ico'), ico);
  console.log('Generated icon.ico');

  // Generate .png for Linux
  require('fs').copyFileSync(path.join(outputDir, 'icon.png'), path.join(outputDir, 'icon.png'));
  console.log('Generated icon.png (for Linux)');
}

generateIcon().catch(console.error);
