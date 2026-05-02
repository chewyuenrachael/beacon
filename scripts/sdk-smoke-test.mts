import { Agent } from "@cursor/sdk";
import "dotenv/config";

const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2" },
  local: { cwd: process.cwd() },
});

const run = await agent.send(
  "In 3 sentences, summarize what this Beacon repository does. Reference SPEC.md if it exists."
);

for await (const event of run.stream()) {
  console.log(event);
}
