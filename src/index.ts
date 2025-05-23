import { DurableObject } from "cloudflare:workers";

export interface Env {
  COUNTERS: DurableObjectNamespace<Counter>;
}

// Worker
export default {
  async fetch(request, env) {
    let url = new URL(request.url);
    let name = url.searchParams.get("name");
    if (!name) {
      return new Response(
        "Select a Durable Object to contact by using" +
          " the `name` URL query string parameter, for example, ?name=A",
      );
    }

    // Every unique ID refers to an individual instance of the Counter class that
    // has its own state. `idFromName()` always returns the same ID when given the
    // same string as input (and called on the same class), but never the same
    // ID for two different strings (or for different classes).
    let id = env.COUNTERS.idFromName(name);

    // Construct the stub for the Durable Object using the ID.
    // A stub is a client Object used to send messages to the Durable Object.
    let stub = env.COUNTERS.get(id);

    let count = null;
    switch (url.pathname) {
      case "/increment":
        count = await stub.increment();
        break;
      case "/decrement":
        count = await stub.decrement();
        break;
      case "/":
        // Serves the current value.
        count = await stub.getCounterValue();
        break;
      default:
        return new Response(JSON.stringify({ error: "Not found" }), {status: 404, headers: { 'Content-Type': 'application/json' }});
    }

    return new Response(JSON.stringify({ name, count }), {headers: { 'Content-Type': 'application/json' }});
  },
} satisfies ExportedHandler<Env>;

// Durable Object
export class Counter extends DurableObject {
  async getCounterValue() {
    let value = (await this.ctx.storage.get("value")) || 0;
    return value;
  }

  async increment(amount = 1) {
    let value: number = (await this.ctx.storage.get("value")) || 0;
    value += amount;
    // You do not have to worry about a concurrent request having modified the value in storage.
    // "input gates" will automatically protect against unwanted concurrency.
    // Read-modify-write is safe.
    await this.ctx.storage.put("value", value);
    return value;
  }

  async decrement(amount = 1) {
    let value: number = (await this.ctx.storage.get("value")) || 0;
    value -= amount;
    await this.ctx.storage.put("value", value);
    return value;
  }
}
