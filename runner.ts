import { Entity, SingleRunner, ClusterSchema, Singleton } from "@effect/cluster"
import { BunClusterSocket, BunRuntime } from "@effect/platform-bun"
import { Rpc } from "@effect/rpc"
import { Effect, Layer, Schema, Logger, LogLevel, Array, Mailbox, Stream} from "effect"
import { func } from "effect/FastCheck"
import { increment } from "effect/MutableRef"


const Counter = Entity.make("Counter", [
  Rpc.make("Increment", {
    payload: { amount: Schema.Number },
    success: Schema.Number,
  }),
  Rpc.make("Decrement", {
    payload: { amount: Schema.Number },
    success: Schema.Number,
  }),
  Rpc.make("Stream", {
    success:Schema.Number,
    stream:true
  })

]).annotateRpcs(ClusterSchema.Persisted, true)

const CounterLive = Counter.toLayer(
  Effect.gen(function* () {
    const address = yield* Entity.CurrentAddress
    let state = 0

    return {
      Increment: Effect.fnUntraced(function* ({ payload: { amount } }) {
        yield* Effect.log("Increment", address.toString())
        state += amount
        return state
      }),
      Decrement: Effect.fnUntraced(function* ({ payload: { amount } }) {
        yield* Effect.log("Decrement", address.toString())
        state -= amount
        return state
      }),
    
      Stream: Effect.fnUntraced(function* () {
        const mailbox = yield* Mailbox.make<number>()

        let i = 0
        yield* Effect.suspend(() => mailbox.offer(i++)).pipe(
          Effect.andThen(Effect.sleep(1000)),
          Effect.forever,
          Effect.forkScoped,
        )

        return mailbox
      }),
  }}),
  {maxIdleTime:"10 seconds", concurrency:100},
)

const Increment = Singleton.make(
  "increment", 
  Effect.gen(function* () {
    const makeClinet = yield* Counter.client;
    const client = makeClinet("Client-1");
    console.log("Increment");
    yield* client.Increment({amount:4})
  })
)

const Decrement = Singleton.make(
  "decrement", 
  Effect.gen(function* () {
    const makeClinet = yield* Counter.client;
    const client = makeClinet("Client-1");
    console.log("Increment");
    yield* client.Increment({amount:4})
  })
);

const SendStreams = Array.makeBy(1, (i) =>
  Singleton.make(
    `SendStreams${i}`,
    Effect.gen(function* () {
      const makeClient = yield* Counter.client
      console.log("SendStreams started")
      for (let i = 0; i < 5; i++) {
        const client = makeClient(`client-${i}`)
        yield* client.Stream().pipe(
          Stream.runForEach((i) => Effect.log("stream", i)),
          Effect.forkScoped,
        )
      }
    }),
  ),
)

const Entities  = Layer.mergeAll(
  CounterLive,
  Increment,
  Decrement,
  ...SendStreams
)

const shardLive = BunClusterSocket.layer({storage:"local"});

Entities.pipe(
  Layer.provide(shardLive),
  Layer.provide(Logger.minimumLogLevel(LogLevel.All)),
  Layer.launch,
  BunRuntime.runMain
)