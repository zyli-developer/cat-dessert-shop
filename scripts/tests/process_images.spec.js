const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const {
  buildResizeOptions,
  buildPngOptions,
  removeWhiteBackground,
  processImage,
} = require('../process_images');

describe('buildPngOptions (TC-SCR-PROC-001 - compression strategy)', () => {
  it('uses max PNG compressionLevel=9 and quality=80 for smallest output', () => {
    // Note: the script has no "4MB budget" logic; its compression strategy is
    // fixed PNG options. We test that strategy instead of a fabricated budget.
    const opts = buildPngOptions();
    expect(opts.compressionLevel).toBe(9);
    expect(opts.quality).toBe(80);
  });

  it('produces a smaller encoded PNG than the default compression level', async () => {
    // Build a simple 64x64 RGBA buffer so sharp has something to encode.
    const raw = Buffer.alloc(64 * 64 * 4);
    for (let i = 0; i < raw.length; i += 4) {
      raw[i] = (i / 4) % 256;
      raw[i + 1] = 128;
      raw[i + 2] = 64;
      raw[i + 3] = 255;
    }
    const maxCompressed = await sharp(raw, { raw: { width: 64, height: 64, channels: 4 } })
      .png(buildPngOptions())
      .toBuffer();
    const noCompression = await sharp(raw, { raw: { width: 64, height: 64, channels: 4 } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(maxCompressed.length).toBeLessThanOrEqual(noCompression.length);
  });
});

describe('buildResizeOptions / removeWhiteBackground (TC-SCR-PROC-002 - alpha preservation)', () => {
  it('uses a fully transparent background when removeBg is true', () => {
    const opts = buildResizeOptions({ w: 40, h: 40, removeBg: true });
    expect(opts.fit).toBe('contain');
    expect(opts.background).toEqual({ r: 0, g: 0, b: 0, alpha: 0 });
  });

  it('uses opaque white background when removeBg is false', () => {
    const opts = buildResizeOptions({ w: 720, h: 1280, removeBg: false });
    expect(opts.background).toEqual({ r: 255, g: 255, b: 255, alpha: 1 });
  });

  it('removeWhiteBackground converts near-white pixels to alpha=0 and keeps colored pixels opaque', async () => {
    // 2x1 image: white + red
    const raw = Buffer.from([255, 255, 255, 255, 255, 0, 0, 255]);
    const png = await sharp(raw, { raw: { width: 2, height: 1, channels: 4 } })
      .png()
      .toBuffer();

    const processed = await removeWhiteBackground(png);
    const { data, info } = await sharp(processed)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(info.channels).toBe(4);
    // Pixel 0 was white -> alpha should now be 0
    expect(data[3]).toBe(0);
    // Pixel 1 was red -> alpha should remain 255
    expect(data[7]).toBe(255);
  });
});

describe('processImage (TC-SCR-PROC-003 - sharp error handling)', () => {
  let tmpIn, tmpOut;
  beforeEach(() => {
    tmpIn = fs.mkdtempSync(path.join(os.tmpdir(), 'proc-in-'));
    tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'proc-out-'));
  });
  afterEach(() => {
    fs.rmSync(tmpIn, { recursive: true, force: true });
    fs.rmSync(tmpOut, { recursive: true, force: true });
  });

  it('when sharp throws during processing, processImage returns false and does not throw (current behavior - FOLLOW-UP: template expected propagation)', async () => {
    // Write a real input file so existsSync() passes.
    const inputName = 'boom.png';
    fs.writeFileSync(path.join(tmpIn, inputName), Buffer.from('not-a-real-png'));

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const fakeSharp = () => {
      throw new Error('sharp blew up');
    };

    const result = await processImage(
      inputName,
      { w: 10, h: 10, removeBg: false },
      { sharp: fakeSharp, inputDir: tmpIn, outputDir: tmpOut },
    );

    expect(result).toBe(false);
    // The error path logs via console.error — confirm it was hit.
    expect(errSpy).toHaveBeenCalled();
    // And no output file was written.
    expect(fs.existsSync(path.join(tmpOut, inputName))).toBe(false);

    errSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe('processImage (TC-SCR-PROC-004 - missing input / empty-dir no-op)', () => {
  let tmpIn, tmpOut;
  beforeEach(() => {
    tmpIn = fs.mkdtempSync(path.join(os.tmpdir(), 'proc-in-'));
    tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'proc-out-'));
  });
  afterEach(() => {
    fs.rmSync(tmpIn, { recursive: true, force: true });
    fs.rmSync(tmpOut, { recursive: true, force: true });
  });

  it('returns false without throwing when input file is absent (empty input dir)', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await processImage(
      'does_not_exist.png',
      { w: 10, h: 10, removeBg: true },
      { inputDir: tmpIn, outputDir: tmpOut },
    );

    expect(result).toBe(false);
    // No output written, output dir remains empty.
    expect(fs.readdirSync(tmpOut)).toEqual([]);
    logSpy.mockRestore();
  });
});
