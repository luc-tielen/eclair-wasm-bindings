// POC code

/*
enum Direction {
  INPUT,
  OUTPUT,
  INPUT_OUTPUT,
}

enum FieldType {
  U32,
  String,
}

type Fields = Record<string, FieldType>;

type Fact<Name extends string, Dir extends Direction, F extends Fields> = {
  name: Name;
  direction: Dir;
} & F;

type Edge = Fact<
  "edge",
  Direction.INPUT,
  { from: FieldType.U32; to: FieldType.U32 }
>;

type Reachable = Fact<
  "reachable",
  Direction.OUTPUT,
  { from: FieldType.U32; to: FieldType.U32 }
>;

// TODO how to constrain these generics?
type Program<Name, Facts> = {
  name: Name;
  facts: Facts;
};

type Path = Program<"path", [Edge, Reachable]>;

type X = Path["facts"];
*/

enum Direction {
  INPUT,
  OUTPUT,
  INPUT_OUTPUT,
}

enum FieldType {
  Number = "NUMBER",
  String = "STRING",
}

const number = () => FieldType.Number;
const string = () => FieldType.String;

// TODO
const SERIALIZERS: {
  [FieldType.Number]: (x: number) => void;
  [FieldType.String]: (x: string) => void;
} = {
  [FieldType.Number]: () => { },
  [FieldType.String]: () => { },
};

const DESERIALIZERS: {
  [FieldType.Number]: () => number;
  [FieldType.String]: () => string;
} = {
  [FieldType.Number]: () => 42,
  [FieldType.String]: () => "abc",
};

// Order needs to be preserved!
type Fields = FieldType[];

type ColumnType<T extends FieldType> = T extends FieldType.Number
  ? number
  : string;

type FactValue<T extends FieldType[]> = {
  [Property in keyof T]: ColumnType<T[Property]>;
};

type X = FactValue<[FieldType.Number, FieldType.String]>;

const fact = <T>(name: string, dir: Direction, fields: Fields) => {
  const serializers = fields.map((field) => SERIALIZERS[field]);
  const deserializers = fields.map((field) => DESERIALIZERS[field]);

  return {
    name,
    dir,
    fields,
    addFact: (fact: FactValue<T>) => {
      for (const k in fact) {
        const field = fields[k];
        const value = fact[k];
        serializers[field](value);
      }
    },
    getFact: (): FactValue<T> =>
      fields.map((field) => deserializers[field]()) as FactValue<T>,
  };
};

const edge = fact("edge", Direction.INPUT, [
  FieldType.Number,
  FieldType.String,
]);
/*
interface Literal<T> {
  shape: () => T;
}

// TODO how to add other fields
const f = <T>(fields: T): Literal<T> => {
  return { shape: () => fields };
};
*/
/* TODO try again in a bit
const fact = <T extends Fields>(name: string, dir: Direction, fields: T) => {
  const serializers = Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, SERIALIZERS[field]])
  );

  return {
    name,
    dir,
    fields,
    addFact: (fact: FactValue<T>) => {
      Object.entries(fact).forEach(([key, value]) => {
        const serializer = serializers[key]
        serializer(value)
      })


      Object.entries(fields).map(([key, fieldType]) => {
        switch (fieldType) {
          case FieldType.Number: {
            const value: boolean = fact[key]; // TODO
            console.log(value);
            break;
          }
          case FieldType.String: {
            const value: string = fact[key]; // TODO
            console.log(value);
            // TODO
            break;
          }
        }
      });
    },
  };
};
*/

/*
const program = ({ code, facts }) => { };

// fields
const edge = fact("edge", Direction.INPUT);
const reachable = fact("reachable", Direction.OUTPUT);
const path = program({ code: null, facts: [edge, reachable] });

path.edge.addFact([
  { from: 1, to: 2 },
  { from: 2, to: 3 },
]);
path.edge.addFacts([{ from: 2, to: 3 }]);

// reachable should be type error
const reachables = path.reachable.getFacts();

reachables.forEach(console.log);*/
