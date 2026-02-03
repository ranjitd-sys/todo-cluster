import { Entity, SingleRunner, ClusterSchema, Singleton } from "@effect/cluster"
import { BunClusterSocket, BunRuntime } from "@effect/platform-bun"
import { Rpc } from "@effect/rpc"
import { Effect, Layer, Schema, Logger, LogLevel, Array} from "effect"


const Counter = Entity.make("Counter", [
  Rpc.make("Increment", {
    payload: { amount: Schema.Number },
    success: Schema.Number,
  }),
  Rpc.make("Decrement", {
    payload: { amount: Schema.Number },
    success: Schema.Number,
  }),
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
    }
  }),
  {maxIdleTime:"10 seconds", concurrency:100},
)

const IncremenFunc 