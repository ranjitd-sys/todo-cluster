import {
  BunClusterSocket,
  BunRuntime,
} from "@effect/platform-bun"
import { Layer } from "effect"


BunClusterSocket.layer({ storage: "local" }).pipe(
  Layer.launch,
  BunRuntime.runMain,
)
