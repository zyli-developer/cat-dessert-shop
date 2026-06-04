const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');
const { buildRequestOptions, parseImagePart, generateImage } = require('../generate_images');

describe('buildRequestOptions', () => {
  it('encodes API key and prompt into Gemini request shape', () => {
    const { options, body } = buildRequestOptions('KEY', 'gemini-2.5-flash-image', 'a cat');
    expect(options.method).toBe('POST');
    expect(options.hostname).toMatch(/googleapis/);
    expect(options.path).toContain('gemini-2.5-flash-image');
    expect(options.headers['x-goog-api-key']).toBe('KEY');
    expect(options.headers['Content-Type']).toBe('application/json');
    const parsed = JSON.parse(body);
    expect(parsed.contents?.[0]?.parts?.[0]?.text ?? JSON.stringify(parsed)).toContain('a cat');
  });
});

describe('parseImagePart', () => {
  it('TC-SCR-GEN-001 returns Buffer from a well-formed image response', () => {
    const fake = {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('hello').toString('base64') } }] } }],
    };
    const buf = parseImagePart(JSON.stringify(fake));
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe('hello');
  });

  it('TC-SCR-GEN-002 throws on Gemini API error envelope', () => {
    expect(() => parseImagePart(JSON.stringify({ error: { code: 400, message: 'API key not valid' } })))
      .toThrow(/API key not valid|Gemini API error/);
  });

  it('TC-SCR-GEN-003 throws when response has no image part', () => {
    expect(() => parseImagePart(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'just text' }] } }] })))
      .toThrow(/No image in response/);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseImagePart('not json')).toThrow(/Invalid JSON response/);
  });
});

describe('generateImage (integration with mocked https)', () => {
  let tmp;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('writes decoded image to outputPath when httpsRequest returns success', async () => {
    const fakeBody = JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('PNGBYTES').toString('base64') } }] } }],
    });
    const httpsRequest = (_options, cb) => {
      const res = new PassThrough();
      res.statusCode = 200;
      process.nextTick(() => { cb(res); res.end(fakeBody); });
      return { on: () => ({}), write: () => {}, end: () => {} };
    };
    const outputPath = path.join(tmp, 'out.png');
    await generateImage('prompt', outputPath, { httpsRequest, apiKey: 'KEY' });
    expect(fs.readFileSync(outputPath).toString()).toBe('PNGBYTES');
  });
});
