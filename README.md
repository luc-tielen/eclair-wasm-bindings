# Eclair WASM bindings

This library provides a high level API for Javascript / Typescript to execute
Eclair Datalog programs compiled to WebAssembly.

## Getting started

Given the following Eclair program to compute all reachable points in a graph:

```prolog
@def edge(u32, u32).
@def reachable(u32, u32).

// 2 points are reachable from one another if there is a direct edge between them.
reachable(x, y) :-
  edge(x, y).

// 2 points are reachable from one another if there is a third point 'y'
// such that there is an edge from 'x' to 'y', and 'z' is reachable from 'y'.
reachable(x, z) :-
  edge(x, y),
  reachable(y, z).
```

Then the snippet below shows how you can use this library:

```typescript
import {
  withEclair,
  fact,
  program,
  U32,
  INPUT,
  OUTPUT,
} from 'eclair-wasm-bindings';

// We need to provide Eclair enough memory to run. The amount you need to
// provide depends on how much data you are processing with Eclair.
const memory = new WebAssembly.Memory({ initial: 10, maximum: 100 });

// Fetch / compile the WASM program.
const { instance: wasmInstance } = await WebAssembly.instantiateStreaming(
  fetch('/path/to/eclair_program.wasm'),
  { env: { memory } }
);

// Now start Eclair using `withEclair`. This automatically takes care of
// resource cleanup as well.
const results = withEclair(wasmInstance, memory, (handle) => {
  // Next we define what the Eclair program looks like.
  // Important: This has to match *exactly* with how you defined it in
  // Eclair Datalog, otherwise you will get unexpected results!
  const edge = fact('edge', INPUT, [U32, U32]);
  const reachable = fact('reachable', OUTPUT, [U32, U32]);
  const path = program(handle, [edge, reachable]);

  // Now we can add facts to Eclair (LSP provides autocomplete!)
  path.edge.addFact([1, 2]);
  path.edge.addFacts([
    [2, 3],
    [3, 4],
  ]);

  // We let Eclair do the number crunching..
  path.run();

  // And finally you can get results back out!
  const reachableFacts = path.reachable.getFacts();

  // You can do anything with the results here..
  console.log(reachableFacts);

  // Or you can return the results so they can be used outside this function!
  return reachableFacts;
});
```
