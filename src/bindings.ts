type Address = number;

interface Program {
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

type EclairInstance = Omit<WebAssembly.Instance, "exports"> & API;

interface EclairProgram {
  instance: EclairInstance;
  memory: WebAssembly.Memory;
  handle: Program;
}

enum FieldType { } // TODO use other code here..
interface FactMetadata {
  name: string;
  fields: [FieldType, ...FieldType[]];
}

const programInit = (
  wasm: WebAssembly.Instance,
  memory: WebAssembly.Memory
): EclairProgram => {
  // NOTE: this cast is very unsafe, but we need to rely on the dev to pass
  // in a WASM program compiled with Eclair.
  const instance = wasm as EclairInstance;
  return {
    instance,
    memory,
    handle: { address: instance.exports.eclair_program_init() },
  };
};

const programRun = (program: EclairProgram) =>
  program.instance.exports.eclair_program_run(program.handle.address);

const programDestroy = (program: EclairProgram) =>
  program.instance.exports.eclair_program_destroy(program.handle.address);

// TODO carry type information to this point, needed for serialization
const addFact = (
  program: EclairProgram,
  metadata: FactMetadata,
  fact: (number | string)[]
) => {
  const byteCount = metadata.fields.length * Uint32Array.BYTES_PER_ELEMENT;
  const address = program.instance.exports.eclair_malloc(byteCount);
  const array = new Uint32Array(program.memory.buffer, address, byteCount);
  array.set(fact); // TODO encode additional strings if needed
  const factType = encodeString(program, metadata.name);
  program.instance.exports.eclair_add_fact(
    program.handle.address,
    factType,
    address
  );
  program.instance.exports.eclair_free(address);
};

const addFacts = (
  program: EclairProgram,
  metadata: FactMetadata,
  facts: (number | string)[][]
) => {
  const byteCount =
    facts.length * metadata.fields.length * Uint32Array.BYTES_PER_ELEMENT;
  const address = program.instance.exports.eclair_malloc(byteCount);
  const array = new Uint32Array(program.memory.buffer, address, byteCount);
  array.set(facts.flat()); // TODO encode additional strings if needed

  const factType = encodeString(program, metadata.name);
  program.instance.exports.eclair_add_facts(
    program.handle.address,
    factType,
    address,
    facts.length
  );
  program.instance.exports.eclair_free(address);
};

// TODO carry type info to here
const getFacts = (program: EclairProgram, metadata: FactMetadata) => {
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
  // TODO Array<Fact<...>>
  const result: Array<number> = new Array(factCount);
  for (let i = 0; i < resultArray.length; i += numColumns) {
    const factData = resultArray.slice(i, i + numColumns);
    result[i] = null; // TODO transform to fact
  }

  program.instance.exports.eclair_free_buffer(resultAddress);
  return result;
};

const encodeString = (program: EclairProgram, str: string) => {
  // Conversion from UTF16 => UTF8 takes worst case 3x as many bytes
  const maxByteCount = str.length * 3;
  const address = program.instance.exports.eclair_malloc(maxByteCount);
  const array = new Uint8Array(program.memory.buffer, address, maxByteCount);
  const { written } = new TextEncoder().encodeInto(str, array);
  const strIndex = program.instance.exports.eclair_encode_string(
    program.handle.address,
    written as number, // TODO check if written is correct
    address
  );
  program.instance.exports.eclair_free(address);
  return strIndex;
};

const decodeString = (program: EclairProgram, strIndex: number) => {
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
