const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateImages } = require('../generate_images');

describe('generateImages', () => {
  let tmp;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('TC-SCR-GEN-001 creates one file per size config', async () => {
    const sharpMock = () => ({
      resize: () => sharpMock(),
      png: () => sharpMock(),
      toFile: (p) => fs.promises.writeFile(p, Buffer.from('fake')),
    });
    await generateImages({ sizes: [64, 128], outputDir: tmp, sharp: sharpMock });
    expect(fs.readdirSync(tmp).sort()).toEqual(['128.png', '64.png']);
  });

  it('TC-SCR-GEN-002 rejects non-numeric size', async () => {
    await expect(generateImages({ sizes: ['oops'], outputDir: tmp }))
      .rejects.toThrow();
  });

  it('TC-SCR-GEN-003 throws when output path not writable', async () => {
    // Use a truly unwritable path: nested under an existing file (not a directory)
    const notADir = path.join(tmp, 'file.txt');
    fs.writeFileSync(notADir, 'x');
    const badOutput = path.join(notADir, 'sub');
    const sharpMock = () => ({
      resize: () => sharpMock(),
      png: () => sharpMock(),
      toFile: (p) => fs.promises.writeFile(p, Buffer.from('fake')),
    });
    await expect(generateImages({ sizes: [64], outputDir: badOutput, sharp: sharpMock }))
      .rejects.toThrow();
  });
});
