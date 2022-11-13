import {
  FieldType,
  Direction,
  type FactShape,
  type FactValue,
  type FactMetadata,
  type EclairProgram,
  type EclairInstance,
} from './types';

export const encodeString = (program: EclairProgram, str: string) => {
  // Conversion from UTF16 => UTF8 takes worst case 3x as many bytes
  const maxByteCount = str.length * 3;
  const address = program.instance.exports.eclair_malloc(maxByteCount);
  const array = new Uint8Array(program.memory.buffer, address, maxByteCount);
  const { written } = new TextEncoder().encodeInto(str, array);
  const strIndex = program.instance.exports.eclair_encode_string(
    program.handle.address,
    written as number,
    address
  );
  program.instance.exports.eclair_free(address);
  return strIndex;
};

export const decodeString = (program: EclairProgram, strIndex: number) => {
  const symbolAddress = program.instance.exports.eclair_decode_string(
    program.handle.address,
    strIndex
  );
  const [length, dataAddress] = new Uint32Array(
    program.memory.buffer,
    symbolAddress,
    2
  );
  const byteArray = new Uint8Array(program.memory.buffer, dataAddress, length);
  return new TextDecoder().decode(byteArray);
};

const SERIALIZERS = {
  [FieldType.Number]: (_program: EclairProgram, value: number) => value,
  [FieldType.String]: encodeString,
};

const DESERIALIZERS = {
  [FieldType.Number]: (_program: EclairProgram, value: number) => value,
  [FieldType.String]: decodeString,
};

export const programInit = (
  wasm: WebAssembly.Instance,
  memory: WebAssembly.Memory
): EclairProgram => {
  // NOTE: this cast is very unsafe since we don't know anything about the
  // WASM instance passed in, but we need to rely on the dev to pass in a
  // WASM program compiled with Eclair.
  const instance = wasm as EclairInstance;
  return {
    instance,
    memory,
    handle: { address: instance.exports.eclair_program_init() },
  };
};

export const programRun = (program: EclairProgram) =>
  program.instance.exports.eclair_program_run(program.handle.address);

export const programDestroy = (program: EclairProgram) =>
  program.instance.exports.eclair_program_destroy(program.handle.address);

const serializeFact = <Shape extends FactShape>(
  program: EclairProgram,
  metadata: FactMetadata<string, Direction, Shape>
) => {
  const shape = metadata.fields;
  const serializers = shape.map((field) => SERIALIZERS[field]);

  return (fact: FactValue<Shape>) => {
    const result = Array.from(shape, () => 0);

    for (const column in fact) {
      const field = shape[column];
      const value = fact[column];
      result[column] = serializers[field](program, value);
    }

    return result;
  };
};

export const addFact = <Shape extends FactShape>(
  program: EclairProgram,
  metadata: FactMetadata<string, Direction, Shape>,
  fact: FactValue<Shape>
) => {
  const byteCount = metadata.fields.length * Uint32Array.BYTES_PER_ELEMENT;
  const address = program.instance.exports.eclair_malloc(byteCount);

  const array = new Uint32Array(program.memory.buffer, address, byteCount);
  array.set(serializeFact(program, metadata)(fact));

  const factType = encodeString(program, metadata.name);
  program.instance.exports.eclair_add_fact(
    program.handle.address,
    factType,
    address
  );
  program.instance.exports.eclair_free(address);
};

export const addFacts = <Shape extends FactShape>(
  program: EclairProgram,
  metadata: FactMetadata<string, Direction, Shape>,
  facts: FactValue<Shape>[]
) => {
  const byteCount =
    facts.length * metadata.fields.length * Uint32Array.BYTES_PER_ELEMENT;
  const address = program.instance.exports.eclair_malloc(byteCount);

  const array = new Uint32Array(program.memory.buffer, address, byteCount);
  const serializeOneFact = serializeFact(program, metadata);
  array.set(facts.flatMap(serializeOneFact));

  const factType = encodeString(program, metadata.name);
  program.instance.exports.eclair_add_facts(
    program.handle.address,
    factType,
    address,
    facts.length
  );
  program.instance.exports.eclair_free(address);
};

export const getFacts = <Shape extends FactShape>(
  program: EclairProgram,
  metadata: FactMetadata<string, Direction, Shape>
): FactValue<Shape>[] => {
  const factType = encodeString(program, metadata.name);
  const resultAddress = program.instance.exports.eclair_get_facts(
    program.handle.address,
    factType
  );
  const factCount = program.instance.exports.eclair_fact_count(
    program.handle.address,
    factType
  );

  const numColumns = factCount * metadata.fields.length;
  const resultArray = new Uint32Array(
    program.memory.buffer,
    resultAddress,
    numColumns
  );

  const shape = metadata.fields;
  const deserializers = shape.map((field) => DESERIALIZERS[field]);
  const array = Array(factCount).map((_empty, i) => {
    const startIndex = i * numColumns;
    const endIndex = startIndex + numColumns;
    return Array.from(resultArray.slice(startIndex, endIndex)).map((value, i) =>
      deserializers[i](program, value)
    );
  });

  program.instance.exports.eclair_free_buffer(resultAddress);
  return array as FactValue<Shape>[];
};
