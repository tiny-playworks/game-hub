import {
  applyEvent,
  createMatch,
  nextServerAiEvent,
  prepareRiichiRuntime,
} from './runtime';

await prepareRiichiRuntime();
let match = createMatch({ seed: 1, matchLength: 'east' }).match;
let steps = 0;
while (match.status === 'playing' && steps < 500) {
  const event = nextServerAiEvent(match, true);
  if (!event) throw new Error(`No server AI event at step ${steps}`);
  const next = applyEvent(match, event);
  if (!next) throw new Error(`Illegal server AI event at step ${steps}`);
  match = next.match;
  steps += 1;
}
if (match.status !== 'roundEnd' || !match.round.result) {
  throw new Error(`Node/WASM round did not finish after ${steps} steps`);
}
console.log(`Node/WASM round completed in ${steps} events (${match.round.result.type})`);
