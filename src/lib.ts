import {
  Direction,
  FieldType,
  type FactShape,
  type FactMetadata,
  type FactValue,
  type Program,
  type EclairProgram,
} from './types';
import { addFact, addFacts, getFacts } from './bindings';

export const number = (): FieldType.Number => FieldType.Number;

export const string = (): FieldType.String => FieldType.String;

const fact = <
  Name extends string,
  Dir extends Direction,
  Shape extends FactShape
>(
  name: Name,
  dir: Dir,
  fields: Shape
): FactMetadata<Name, Dir, Shape> => {
  return {
    name,
    dir,
    fields,
    // serialize: null,
    // deserialize: null,
    // serialize: (program: EclairProgram, fact: FactValue<T>) => {
    //   for (const k in fact) {
    //     const field = fields[k];
    //     const value = fact[k];
    //     serializers[field](program, value);
    //   }
    // },
    // deserialize: (program: EclairProgram, value: number) =>
    //   fields.map((_field, i) =>
    //     deserializers[i](program, value)
    //   ) as FactValue<T>,
  };
};

const program = <T extends ArrayLike<unknown>>(
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

  return result as Program<T>;
};

// TODO move to README
const edge = fact('edge', Direction.INPUT, [
  FieldType.Number,
  FieldType.Number,
]);
const reachable = fact('reachable', Direction.OUTPUT, [
  FieldType.Number,
  FieldType.Number,
]);

const eclair = program(null, [edge, reachable]);

eclair.edge.addFact([1, 2]);
eclair.edge.addFacts([
  [2, 3],
  [3, 4],
]);

console.log(eclair.reachable.getFacts());
