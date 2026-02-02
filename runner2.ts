const ShardingLive = Sharding.layer.pipe(
  Layer.provide(Manager.layer),
  Layer.provide(Pods.layerMemory),
  Layer.provide(Storage.layerMemory),
  Layer.provide(BunClusterSocket.layer()) // <--- Uses Bun's socket implementation
);

// --- 4. The Program ---
const program = Effect.gen(function* () {
  const client = yield* Counter.client;
  const entityId = "global-counter";

  const n1 = yield* client.increment(entityId);
  yield* Console.log(`[Bun Cluster] Count is: ${n1}`);

  const n2 = yield* client.increment(entityId);
  yield* Console.log(`[Bun Cluster] Count is: ${n2}`);
});

// --- 5. Run it ---
program.pipe(
  Effect.provide(Counter.register(makeCounter)),
  Effect.provide(ShardingLive),
  Effect.provide(BunContext.layer),
  Effect.runPromise
);