import {
  Direction,
  FieldType,
  type FactShape,
  type FactMetadata,
  type FactValue,
  type Program,
  type EclairProgram,
} from './types';
import {
  programInit,
  programRun,
  programDestroy,
  addFact,
  addFacts,
  getFacts,
} from './bindings';

export const u32 = FieldType.Number;
export const string = FieldType.String;

export const fact = <
  Name extends string,
  Dir extends Direction,
  Shape extends FactShape
>(
  name: Name,
  dir: Dir,
  fields: Shape
): FactMetadata<Name, Dir, Shape> => ({ name, dir, fields });

export const program = <T extends ArrayLike<unknown>>(
  program: EclairProgram,
  facts: T
): Program<T> => {
  const result = Object.fromEntries(
    Object.values(facts).map((factMetadata) => {
      type Key = keyof T;
      type FactType = T[Key] extends FactMetadata<
        string,
        Direction,
        infer Shape
      >
        ? FactValue<Shape>
        : never;

      type FactMD = T[Key] extends FactMetadata<
        infer Name,
        infer Dir,
        infer Shape
      >
        ? FactMetadata<Name, Dir, Shape>
        : never;
      const factData = factMetadata as FactMD;

      return [
        factData.name,
        {
          ...([Direction.INPUT, Direction.INPUT_OUTPUT].includes(
            factData.dir
          ) && {
            addFact: (fact: FactType) => addFact(program, factData, fact),
            addFacts: (facts: FactType[]) => addFacts(program, factData, facts),
          }),
          ...([Direction.OUTPUT, Direction.INPUT_OUTPUT].includes(
            factData.dir
          ) && { getFacts: () => getFacts(program, factData) }),
        },
      ];
    })
  );

  return { run: () => programRun(program), ...result } as Program<T>;
};

export const withEclair = <T>(
  wasm: WebAssembly.Instance,
  memory: WebAssembly.Memory,
  continuation: (program: EclairProgram) => T
) => {
  const handle = programInit(wasm, memory);
  const result = continuation(handle);
  programDestroy(handle);
  return result;
};

const memory = new WebAssembly.Memory({ initial: 10, maximum: 100 });
const wasmBinary = fetch('/path/to/eclair_program.wasm');
const { instance: wasmInstance } = await WebAssembly.instantiateStreaming(
  wasmBinary,
  { js: { mem: memory } }
);

const results = withEclair(wasmInstance, memory, (handle) => {
  const edge = fact('edge', Direction.INPUT, [u32, u32]);
  const reachable = fact('reachable', Direction.OUTPUT, [u32, u32]);
  const path = program(handle, [edge, reachable]);

  path.edge.addFact([1, 2]);
  path.edge.addFacts([
    [2, 3],
    [3, 4],
  ]);

  path.run();

  const reachableFacts = path.reachable.getFacts();

  // You can do anything with the results here..
  console.log(reachableFacts);
  // Or return the results so they can be used outside this function!
  return reachableFacts;
});
