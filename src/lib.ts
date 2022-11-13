import {
  Direction,
  FieldType,
  type FactShape,
  type FactMetadata,
  type FactValue,
  type Program,
  type EclairProgram,
} from './types';
import { SERIALIZERS, DESERIALIZERS } from './serialization';

export const number = (): FieldType.Number => FieldType.Number;

export const string = (): FieldType.String => FieldType.String;

const fact = <Name extends string, Dir extends Direction, T extends FactShape>(
  name: Name,
  dir: Dir,
  fields: T
): FactMetadata<Name, Dir, T> => {
  const serializers = fields.map((field) => SERIALIZERS[field]);
  const deserializers = fields.map((field) => DESERIALIZERS[field]);

  return {
    name,
    dir,
    fields,
    serialize: (program: EclairProgram, fact: FactValue<T>) => {
      for (const k in fact) {
        const field = fields[k];
        const value = fact[k];
        serializers[field](program, value);
      }
    },
    deserialize: (program: EclairProgram, value: number) =>
      fields.map((_field, i) =>
        deserializers[i](program, value)
      ) as FactValue<T>,
  };
};

// TODO pass WASM code as first arg
const program = <T extends ArrayLike<unknown>>(facts: T): Program<T> => {
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

      // TODO init program, or pass in as param
      let program: EclairProgram;

      return [
        factData.name,
        {
          ...([Direction.INPUT, Direction.INPUT_OUTPUT].includes(
            factData.dir
          ) && {
            addFact: factData.serialize,
            addFacts: (facts: FactType[]) =>
              facts.forEach((fact) => factData.serialize(program, fact)),
          }),
          ...([Direction.OUTPUT, Direction.INPUT_OUTPUT].includes(
            factData.dir
          ) && {
            getFacts: () => {
              const count = 10; // TODO use count call
              const result: FactType[] = [];
              for (let i = 0; i < count; i++) {
                result.push(factData.deserialize(program, null) as FactType);
              }
              return result;
            },
          }),
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

const eclair = program([edge, reachable]);

eclair.edge.addFact([1, 2]);
eclair.edge.addFacts([
  [2, 3],
  [3, 4],
]);

console.log(eclair.reachable.getFacts());
