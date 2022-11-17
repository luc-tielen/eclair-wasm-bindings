import fs from 'fs/promises';
import {
  programInit,
  programDestroy,
  programRun,
  addFact,
  addFacts,
  getFacts,
  encodeString,
  decodeString,
} from '../src/bindings';
import { Direction, FieldType } from '../src/types';

describe('bindings', () => {
  const setupWasm = async () => {
    const memory = new WebAssembly.Memory({ initial: 10 });
    const file = await fs.readFile('./tests/fixtures/path.wasm');
    const { instance } = await WebAssembly.instantiate(file.buffer, {
      env: { memory },
    });
    return { instance, memory };
  };

  it('can initialize and cleanup an Eclair program', async () => {
    const { instance, memory } = await setupWasm();
    const program = programInit(instance, memory);
    expect(program.handle.address).not.toEqual(0);
    programDestroy(program);
  });

  describe('programRun', () => {
    it('is valid to run a program without adding any facts', async () => {
      // though if there are no top level facts in the Eclair program,
      // this will give no results.
      const { instance, memory } = await setupWasm();
      const program = programInit(instance, memory);
      programRun(program);
      programDestroy(program);
      const results = getFacts(program, {
        name: 'reachable',
        dir: Direction.OUTPUT,
        fields: [FieldType.Number, FieldType.Number],
      });
      expect(results).toEqual([]);
    });

    it('should compute results after adding a single fact', async () => {
      // though if there are no top level facts in the Eclair program,
      // this will give no results.
      const { instance, memory } = await setupWasm();
      const program = programInit(instance, memory);
      addFact(
        program,
        {
          name: 'edge',
          dir: Direction.INPUT,
          fields: [FieldType.Number, FieldType.Number],
        },
        [1, 2]
      );

      programRun(program);

      const results = getFacts(program, {
        name: 'reachable',
        dir: Direction.OUTPUT,
        fields: [FieldType.Number, FieldType.Number],
      });
      expect(results).toEqual([[1, 2]]);
      programDestroy(program);
    });

    it('should compute results after adding multiple facts', async () => {
      // though if there are no top level facts in the Eclair program,
      // this will give no results.
      const { instance, memory } = await setupWasm();
      const program = programInit(instance, memory);
      addFact(
        program,
        {
          name: 'edge',
          dir: Direction.INPUT,
          fields: [FieldType.Number, FieldType.Number],
        },
        [1, 2]
      );
      addFacts(
        program,
        {
          name: 'edge',
          dir: Direction.INPUT,
          fields: [FieldType.Number, FieldType.Number],
        },
        [
          [2, 3],
          [3, 4],
        ]
      );
      programRun(program);
      const results = getFacts(program, {
        name: 'reachable',
        dir: Direction.OUTPUT,
        fields: [FieldType.Number, FieldType.Number],
      });
      expect(results).toEqual([
        [1, 2],
        [1, 3],
        [1, 4],
        [2, 3],
        [2, 4],
        [3, 4],
      ]);
      programDestroy(program);
    });
  });

  it('is possible to encode a string from TS -> Eclair', async () => {
    const { instance, memory } = await setupWasm();
    const program = programInit(instance, memory);
    const index1 = encodeString(program, 'abc');
    const index2 = encodeString(program, 'abc');
    const index3 = encodeString(program, 'def');
    // 0 and 1 correspond with "edge" and "reachable" in path.eclair
    expect([index1, index2, index3]).toEqual([2, 2, 3]);
    programDestroy(program);
  });

  it('is possible to decode a string from Eclair -> TS', async () => {
    const { instance, memory } = await setupWasm();
    const program = programInit(instance, memory);
    // 0 and 1 correspond with "edge" and "reachable" in path.eclair
    const edge = decodeString(program, 0);
    const reachable = decodeString(program, 1);
    const index1 = encodeString(program, 'abc');
    const index2 = encodeString(program, 'def');
    const str2 = decodeString(program, index2);
    const str1 = decodeString(program, index1);
    expect([edge, reachable, str1, str2]).toEqual([
      'edge',
      'reachable',
      'abc',
      'def',
    ]);
    programDestroy(program);
  });
});
