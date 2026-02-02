import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

export class TodoRpcs extends RpcGroup.make(
    Rpc.make("Increment", {
        success:Schema.Number
    }),
    Rpc.make('Decrement', {
        success:Schema.Number
    })
){}

