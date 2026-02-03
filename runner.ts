import { Entity, SingleRunner, ShardingConfig, ClusterSchema, Singleton, Sharding } from "@effect/cluster"
import { shards } from "@effect/cluster/ClusterMetrics"
import { BunClusterSocket, BunRuntime } from "@effect/platform-bun"
import { Rpc } from "@effect/rpc"
import { Effect, Layer, Schema, Logger, LogLevel, Array, Mailbox, Stream} from "effect"


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

]).annotateRpcs(ClusterSchema.Persisted, false)

const CounterLive = Counter.toLayer(
  Effect.gen(function* () {
    const address = yield* Entity.CurrentAddress
    let state = 0

    return {
      Increment: Effect.fnUntraced(function* ({ payload: { amount } }) {
        try{
          yield* Effect.log("Increment", address.toString())
          state += amount
          return state
        }
        catch(e){
          console.log(e);
          return state;
        }
      }),
      Decrement: Effect.fnUntraced(function* ({ payload: { amount } }) {
        try{
          yield* Effect.log("Decrement", address.toString())
          state -= amount
          return state
        }
        catch(e){
          console.log(e)
          return state
        }
      }),
    
      Stream: Effect.fnUntraced(function* () {
        const mailbox = yield* Mailbox.make<number>()
        let i = 0
        try{
          yield* Effect.suspend(() => mailbox.offer(i++)).pipe(
            Effect.andThen(Effect.sleep(1000)),
            Effect.forever,
            Effect.forkScoped,
          )
  
          return mailbox
        }
        catch(e){
          console.log(e)
          return mailbox;
        }
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
    yield* client.Increment({amount:1})
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
      for (let i = 0; i < 1; i++) {
        const client = makeClient(`client-${i}`)
        yield* client.Stream().pipe(
          Stream.runForEach((i) => Effect.log("stream", i)),
          Effect.forkScoped,
        )
      }
    }),
  ),
)


const LogConfig = Singleton.make(
  "log-config",
  Effect.gen(function* () {
    const sharding = yield* Sharding.Sharding;
    console.log("CLUSTER STARTING WITH SHARDS:", sharding.activeEntityCount);
  })
)
const Entities  = Layer.mergeAll(
  Increment,
  LogConfig,
  CounterLive,
  Decrement,
  ...SendStreams
)



const shardLive = BunClusterSocket.layer({storage:"local", shardingConfig:{shardGroups:["Todo"], shardsPerGroup:10}});

Entities.pipe(
  Layer.provide(shardLive),
  Layer.provide(Logger.minimumLogLevel(LogLevel.All)),
  Layer.launch,
  BunRuntime.runMain
)
