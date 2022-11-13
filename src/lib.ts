// POC code

enum Direction {
  INPUT,
  OUTPUT,
  INPUT_OUTPUT,
}

enum FieldType {
  Number = "NUMBER",
  String = "STRING",
}

const number = (): FieldType.Number => FieldType.Number;
const string = (): FieldType.String => FieldType.String;

// TODO implement
const SERIALIZERS = {
  [FieldType.Number]: (value: number) => { },
  [FieldType.String]: (value: string) => { },
};

// TODO implement
const DESERIALIZERS = {
  [FieldType.Number]: () => 42,
  [FieldType.String]: () => "abc",
};

// Order needs to be preserved, so we can't use object?
// Or do we need to explicitly specify location at the type level?
// Or we can make it a tuple of FieldInfo = {name: string, type: FieldType}
type FactShape = [FieldType, ...FieldType[]];

// Transforms the enum type into the actual underlying column type
type ColumnType<T extends FieldType> = T extends FieldType.Number
  ? number
  : string;

// Type representing a single fact value
type FactValue<T extends FactShape> = {
  [Property in keyof T]: ColumnType<T[Property]>;
};

interface FactMetadata<
  Name extends string,
  Dir extends Direction,
  Shape extends FactShape
> {
  name: Name;
  dir: Dir;
  fields: Shape;
  serialize: (fact: FactValue<Shape>) => void;
  deserialize: () => FactValue<Shape>;
}

interface InputFactHandler<Shape extends FactShape> {
  addFact: (fact: FactValue<Shape>) => void;
  addFacts: (fact: FactValue<Shape>[]) => void;
}

interface OutputFactHandler<Shape extends FactShape> {
  getFacts: () => FactValue<Shape>[];
}

type FactHandler<
  Dir extends Direction,
  Shape extends FactShape
> = Dir extends Direction.INPUT
  ? InputFactHandler<Shape>
  : Dir extends Direction.OUTPUT
  ? OutputFactHandler<Shape>
  : InputFactHandler<Shape> & OutputFactHandler<Shape>;

type GetFactName<T> = T extends FactMetadata<infer Name, any, any>
  ? Name
  : never;

// Program maps a list of fact definitions to an object of fact handlers, where the keys are the names of the facts
type Program<T> = T extends (infer U)[]
  ? {
    // Extract finds the matching union based on the type level fact name.
    // Once it is found, it will map the type to a FactHandler
    [Name in GetFactName<U>]: Extract<U, { name: Name }> extends FactMetadata<
      string,
      infer Dir,
      infer Shape
    >
    ? FactHandler<Dir, Shape>
    : never;
  }
  : never;

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
    serialize: (fact) => {
      for (const k in fact) {
        const field = fields[k];
        const value = fact[k];
        serializers[field](value);
      }
    },
    deserialize: () =>
      fields.map((field, i) => deserializers[i]()) as FactValue<T>,
  };
};

// TODO pass WASM code as first arg
const program = <T extends Object>(facts: T): Program<T> => {
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
            addFact: factData.serialize,
            addFacts: (facts: FactType[]) => facts.forEach(factData.serialize),
          }),
          ...([Direction.OUTPUT, Direction.INPUT_OUTPUT].includes(
            factData.dir
          ) && {
            getFacts: () => {
              const count = 10; // TODO use count call
              const result: FactType[] = [];
              for (let i = 0; i < count; i++) {
                result.push(factData.deserialize() as FactType);
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

const edge = fact("edge", Direction.INPUT, [
  FieldType.Number,
  FieldType.Number,
]);
const reachable = fact("reachable", Direction.OUTPUT, [
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
