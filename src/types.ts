// Types used in the high level API:

export enum Direction {
  INPUT,
  OUTPUT,
  INPUT_OUTPUT,
}

export enum FieldType {
  Number = 'NUMBER',
  String = 'STRING',
}

// Order needs to be preserved, so we can't use object?
// Or do we need to explicitly specify location at the type level?
// Or we can make it a tuple of FieldInfo = {name: string, type: FieldType}
export type FactShape = [FieldType, ...FieldType[]];

// Transforms the enum type into the actual underlying column type
type ColumnType<T extends FieldType> = T extends FieldType.Number
  ? number
  : string;

// Type representing a single fact value
export type FactValue<T extends FactShape> = {
  [Property in keyof T]: ColumnType<T[Property]>;
};

export interface FactMetadata<
  Name extends string,
  Dir extends Direction,
  Shape extends FactShape
> {
  name: Name;
  dir: Dir;
  fields: Shape;
  // TODO remove
  // serialize: (program: EclairProgram, fact: FactValue<Shape>) => void;
  // deserialize: (program: EclairProgram, value: number) => FactValue<Shape>;
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

// eslint-disable-next-line
type GetFactName<T> = T extends FactMetadata<infer Name, any, any>
  ? Name
  : never;

// Program maps a list of fact definitions to an object of fact handlers, where the keys are the names of the facts
export type Program<T> = T extends (infer U)[]
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
  } & { run: () => void }
  : never;

// Types for the low level Eclair interface::

type Address = number;

interface Handle {
  address: Address;
}

interface API {
  exports: {
    eclair_program_init: () => Address;
    eclair_program_run: (handle: Address) => void;
    eclair_program_destroy: (handle: Address) => void;

    eclair_add_fact: (
      handle: Address,
      factType: number,
      factData: Address
    ) => void;
    eclair_add_facts: (
      handle: Address,
      factType: number,
      factData: Address,
      factCount: number
    ) => void;

    eclair_fact_count: (handle: Address, factType: number) => number;
    eclair_get_facts: (handle: Address, factType: number) => Address;
    eclair_free_buffer: (factArray: Address) => void;

    eclair_encode_string: (
      handle: Address,
      length: number,
      str: Address
    ) => number;
    eclair_decode_string: (handle: Address, strIndex: number) => Address;

    eclair_malloc: (byteCount: number) => Address;
    eclair_free: (address: Address) => void;
  };
}

export type EclairInstance = Omit<WebAssembly.Instance, 'exports'> & API;

export interface EclairProgram {
  instance: EclairInstance;
  memory: WebAssembly.Memory;
  handle: Handle;
}
