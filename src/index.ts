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

export type {
  EclairProgram,
  FactShape,
  FactMetadata,
  FactValue,
  Program,
  Direction,
  FieldType,
};

export const INPUT = Direction.INPUT;
export const OUTPUT = Direction.OUTPUT;
export const INPUT_OUTPUT = Direction.INPUT_OUTPUT;
export const U32 = FieldType.Number;
export const STRING = FieldType.String;

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
