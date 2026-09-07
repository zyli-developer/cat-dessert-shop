import { afterEach, describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const postbuildScript = fileURLToPath(
  new URL('../postbuild_subpackage.mjs', import.meta.url),
);
const tempDirs = [];

function makeBuild() {
  const buildDir = mkdtempSync(join(tmpdir(), 'catbakery-postbuild-'));
  tempDirs.push(buildDir);
  mkdirSync(join(buildDir, 'src'), { recursive: true });
  writeFileSync(join(buildDir, 'game.json'), '{}');
  writeFileSync(join(buildDir, 'src', 'settings.json'), JSON.stringify({ assets: {} }));
  return buildDir;
}

function runPostbuild(buildDir, ...bundles) {
  const result = spawnSync(process.execPath, [postbuildScript, buildDir, ...bundles], {
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return result;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('postbuild_subpackage', () => {
  it('moves a bundle into a Douyin subpackage and updates both manifests', () => {
    const buildDir = makeBuild();
    const audioDir = join(buildDir, 'assets', 'audio');
    mkdirSync(audioDir, { recursive: true });
    writeFileSync(join(audioDir, 'index.js'), 'registerAudioBundle();');
    writeFileSync(join(audioDir, 'clip.bin'), 'audio');

    const result = runPostbuild(buildDir, 'audio');

    expect(result.status).toBe(0);
    expect(existsSync(join(buildDir, 'assets', 'audio'))).toBe(false);
    expect(readFileSync(join(buildDir, 'subpackages', 'audio', 'game.js'), 'utf8'))
      .toBe('registerAudioBundle();');
    expect(existsSync(join(buildDir, 'subpackages', 'audio', 'clip.bin'))).toBe(true);

    const game = JSON.parse(readFileSync(join(buildDir, 'game.json'), 'utf8'));
    const settings = JSON.parse(readFileSync(join(buildDir, 'src', 'settings.json'), 'utf8'));
    expect(game.subPackages).toEqual([{ name: 'audio', root: 'subpackages/audio/' }]);
    expect(settings.assets.subpackages).toContain('audio');
  });

  it('fails the build when the remaining main package exceeds 4 MB', () => {
    const buildDir = makeBuild();
    writeFileSync(join(buildDir, 'oversized.bin'), Buffer.alloc(4 * 1048576 + 1));

    const result = runPostbuild(buildDir, 'missing-bundle');

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/4 MB/);
  });
});
