//
import fs from 'fs/promises';
import {
  fact,
  program,
  withEclair,
  U32,
  INPUT,
  OUTPUT,
} from 'eclair-wasm-bindings';

describe('high level API', () => {
  it('can run an Eclair program compiled to WebAssembly', async () => {
    const memory = new WebAssembly.Memory({ initial: 10 });
    const file = await fs.readFile('./tests/fixtures/path.wasm');
    const { instance: wasmInstance } = await WebAssembly.instantiate(
      file.buffer,
      { env: { memory } }
    );

    const results = withEclair(wasmInstance, memory, (handle) => {
      const edge = fact('edge', INPUT, [U32, U32]);
      const reachable = fact('reachable', OUTPUT, [U32, U32]);
      const path = program(handle, [edge, reachable]);

      path.edge.addFact([1, 2]);
      path.edge.addFact([2, 3]);
      path.run();
      return path.reachable.getFacts();
    });

    expect(results).toEqual([
      [1, 2],
      [2, 3],
      [1, 3],
    ]);
  });
});
